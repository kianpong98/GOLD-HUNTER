#!/usr/bin/env python3
"""Update a resilient delayed XAU/DXY cache for the website.

This is not tick data. It is a last-known quote cache used whenever the live
Cloudflare quote endpoints are unavailable.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
import requests

OUT=Path('data/quotes.json')
SESSION=requests.Session()
SESSION.headers.update({'User-Agent':'Mozilla/5.0 (compatible; GoldHunter/1.0)','Accept':'application/json,text/csv,*/*'})

def req(url:str)->requests.Response:
    last=None
    for i in range(4):
        try:
            r=SESSION.get(url,timeout=30);r.raise_for_status();return r
        except Exception as e:
            last=e;time.sleep(2**i)
    raise RuntimeError(f'{url}: {last}')

def yahoo(symbol:str,minv:float,maxv:float)->dict[str,Any]:
    u=f'https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol,safe="")}?interval=1m&range=1d'
    d=req(u).json();res=d.get('chart',{}).get('result',[None])[0]
    if not res:raise RuntimeError(f'Yahoo {symbol} empty')
    meta=res.get('meta',{});closes=res.get('indicators',{}).get('quote',[{}])[0].get('close',[])
    price=meta.get('regularMarketPrice')
    if price is None:
        price=next((v for v in reversed(closes) if isinstance(v,(int,float))),None)
    price=float(price)
    if not(minv<price<maxv):raise RuntimeError(f'Yahoo {symbol} invalid {price}')
    prev=meta.get('chartPreviousClose') or meta.get('previousClose') or meta.get('regularMarketPreviousClose')
    pct=((price-float(prev))/float(prev))*100 if prev else None
    ts=meta.get('regularMarketTime')
    return {'price':price,'changePct':pct,'timestamp':datetime.fromtimestamp(ts,timezone.utc).isoformat() if ts else datetime.now(timezone.utc).isoformat(),'source':f'Yahoo Finance {symbol}','delayed':True}

def first(sources):
    errors=[]
    for fn in sources:
        try:return fn()
        except Exception as e:errors.append(str(e))
    raise RuntimeError(' | '.join(errors))

def main():
    existing={}
    if OUT.exists():
        try:existing=json.loads(OUT.read_text(encoding='utf-8'))
        except Exception:existing={}
    errors={}
    try:gold=first([lambda:yahoo('GC=F',500,20000),lambda:yahoo('XAUUSD=X',500,20000)])
    except Exception as e:gold=existing.get('gold');errors['gold']=str(e)
    try:dxy=first([lambda:yahoo('DX-Y.NYB',50,200),lambda:yahoo('DX=F',50,200),lambda:yahoo('^DXY',50,200)])
    except Exception as e:dxy=existing.get('dxy');errors['dxy']=str(e)
    if not gold and not dxy:raise SystemExit(f'No quote could be updated: {errors}')
    payload={'updatedAt':datetime.now(timezone.utc).isoformat(),'gold':gold,'dxy':dxy,'errors':errors,'note':'Delayed last-known market quotes; not MT5 tick data.'}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(payload,indent=2))
if __name__=='__main__':main()
