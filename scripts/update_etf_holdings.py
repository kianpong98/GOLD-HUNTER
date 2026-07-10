#!/usr/bin/env python3
"""Download the official GLD historical archive and write the latest 30 daily tonnes records."""
from __future__ import annotations
import io, json, re, sys
from datetime import datetime
from pathlib import Path
import requests
from openpyxl import load_workbook

URL='https://api.spdrgoldshares.com/api/v1/historical-archive?exchange=NYSE&lang=en&product=gld'
OUT=Path('assets/data/spdr-gld-holdings.json')

def norm(v): return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()

def parse_date(v):
    if isinstance(v,datetime): return v.date().isoformat()
    if not v: return None
    s=str(v).strip()
    for f in ('%Y-%m-%d','%m/%d/%Y','%d-%b-%Y','%d/%m/%Y','%Y/%m/%d'):
        try:return datetime.strptime(s[:10],f).date().isoformat()
        except ValueError:pass
    try:return datetime.fromisoformat(s.replace('Z','+00:00')).date().isoformat()
    except ValueError:return None

def main():
    r=requests.get(URL,timeout=60,headers={'User-Agent':'GoldHunter/1.0'});r.raise_for_status()
    wb=load_workbook(io.BytesIO(r.content),data_only=True,read_only=True)
    candidates=[]
    for ws in wb.worksheets:
        rows=list(ws.iter_rows(values_only=True))
        for hi,row in enumerate(rows[:30]):
            hs=[norm(x) for x in row]
            di=next((i for i,x in enumerate(hs) if x in ('date','as of date') or 'date'==x),None)
            ti=next((i for i,x in enumerate(hs) if 'tonne' in x or 'metric ton' in x),None)
            if di is None or ti is None: continue
            data=[]
            for rr in rows[hi+1:]:
                if max(di,ti)>=len(rr):continue
                date=parse_date(rr[di]);
                try: tonnes=float(str(rr[ti]).replace(',',''))
                except (TypeError,ValueError):continue
                if date and tonnes>0:data.append({'date':date,'holdings':round(tonnes,3)})
            if len(data)>len(candidates):candidates=data
    if not candidates: raise RuntimeError('Could not locate Date and Tonnes columns in official archive')
    unique={x['date']:x for x in candidates}
    records=sorted(unique.values(),key=lambda x:x['date'])[-30:]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'source':'SPDR Gold Shares official historical archive','sourceUrl':'https://www.spdrgoldshares.com/usa/gld/','updatedAt':datetime.utcnow().isoformat()+'Z','records':records},ensure_ascii=False,indent=2))
    print(f'Wrote {len(records)} records to {OUT}')
if __name__=='__main__':main()
