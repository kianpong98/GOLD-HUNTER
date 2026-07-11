#!/usr/bin/env python3
"""Sync the latest 30 SPDR GLD gold holdings from the official archive."""
from __future__ import annotations
import csv, io, json, re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from openpyxl import load_workbook

API='https://api.spdrgoldshares.com/api/v1/historical-archive?exchange=NYSE&lang=en&product=gld'
PAGE='https://www.spdrgoldshares.com/usa/gld/'
OUT=Path('assets/data/spdr-gld-holdings.json')
HEADERS={'User-Agent':'Mozilla/5.0 (compatible; GoldHunter/1.0)','Accept':'*/*'}

def norm(v): return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def parse_date(v):
    if isinstance(v,datetime): return v.date().isoformat()
    s=str(v or '').strip()
    for f in ('%Y-%m-%d','%m/%d/%Y','%d-%b-%Y','%d/%m/%Y','%Y/%m/%d','%b %d, %Y'):
        try:return datetime.strptime(s[:20],f).date().isoformat()
        except ValueError:pass
    try:return datetime.fromisoformat(s.replace('Z','+00:00')).date().isoformat()
    except ValueError:return None

def find_download(obj):
    if isinstance(obj,str) and re.search(r'\.(xlsx?|csv)(?:\?|$)',obj,re.I): return obj
    if isinstance(obj,dict):
        for v in obj.values():
            u=find_download(v)
            if u:return u
    if isinstance(obj,list):
        for v in obj:
            u=find_download(v)
            if u:return u
    return None

def download_archive():
    r=requests.get(API,timeout=60,headers=HEADERS,allow_redirects=True);r.raise_for_status()
    ctype=(r.headers.get('content-type') or '').lower()
    if r.content[:2]==b'PK' or 'spreadsheet' in ctype or 'excel' in ctype:return r.content,'xlsx'
    if 'csv' in ctype:return r.content,'csv'
    try:
        u=find_download(r.json())
        if u:
            rr=requests.get(urljoin(API,u),timeout=60,headers=HEADERS);rr.raise_for_status()
            return rr.content,'csv' if 'csv' in (rr.headers.get('content-type') or '').lower() or u.lower().endswith('.csv') else 'xlsx'
    except Exception:pass
    page=requests.get(PAGE,timeout=60,headers=HEADERS);page.raise_for_status()
    links=re.findall(r'href=["\']([^"\']+\.(?:xlsx?|csv)(?:\?[^"\']*)?)["\']',page.text,re.I)
    if not links:raise RuntimeError('Official SPDR archive download was not found')
    rr=requests.get(urljoin(PAGE,links[0]),timeout=60,headers=HEADERS);rr.raise_for_status()
    return rr.content,'csv' if links[0].lower().split('?')[0].endswith('.csv') else 'xlsx'

def extract_xlsx(content):
    wb=load_workbook(io.BytesIO(content),data_only=True,read_only=True)
    best=[]
    for ws in wb.worksheets:
        rows=list(ws.iter_rows(values_only=True))
        for hi,row in enumerate(rows[:40]):
            hs=[norm(x) for x in row]
            di=next((i for i,x in enumerate(hs) if x in ('date','as of date') or x.endswith(' date')),None)
            ti=next((i for i,x in enumerate(hs) if 'tonne' in x or 'metric ton' in x),None)
            if di is None or ti is None:continue
            data=[]
            for rr in rows[hi+1:]:
                if max(di,ti)>=len(rr):continue
                date=parse_date(rr[di])
                try: tonnes=float(str(rr[ti]).replace(',','').strip())
                except (TypeError,ValueError):continue
                if date and 100<tonnes<5000:data.append({'date':date,'holdings':round(tonnes,3)})
            if len(data)>len(best):best=data
    return best

def extract_csv(content):
    text=content.decode('utf-8-sig',errors='replace')
    rows=list(csv.reader(io.StringIO(text)))
    best=[]
    for hi,row in enumerate(rows[:40]):
        hs=[norm(x) for x in row]
        di=next((i for i,x in enumerate(hs) if x in ('date','as of date') or x.endswith(' date')),None)
        ti=next((i for i,x in enumerate(hs) if 'tonne' in x or 'metric ton' in x),None)
        if di is None or ti is None:continue
        data=[]
        for rr in rows[hi+1:]:
            if max(di,ti)>=len(rr):continue
            date=parse_date(rr[di])
            try:tonnes=float(rr[ti].replace(',','').strip())
            except (ValueError,AttributeError):continue
            if date and 100<tonnes<5000:data.append({'date':date,'holdings':round(tonnes,3)})
        if len(data)>len(best):best=data
    return best

def main():
    content,kind=download_archive()
    data=extract_csv(content) if kind=='csv' else extract_xlsx(content)
    if not data:raise RuntimeError('Could not locate Date and Tonnes columns in official archive')
    unique={x['date']:x for x in data}
    records=sorted(unique.values(),key=lambda x:x['date'])[-30:]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'source':'SPDR Gold Shares official historical archive','sourceUrl':PAGE,'updatedAt':datetime.now(timezone.utc).isoformat(),'records':records},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Wrote {len(records)} official records to {OUT}')
if __name__=='__main__':main()
