const CACHE_KEY='market-snapshot-v1';
const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'cache-control':'public, max-age=2, s-maxage=5'}});
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
async function fetchGold(){
  const r=await fetch('https://api.gold-api.com/price/XAU',{headers:{accept:'application/json'}});
  if(!r.ok)throw new Error(`Gold API ${r.status}`);
  const d=await r.json();
  const price=num(d.price??d.value??d.ask??d.mid);
  const prev=num(d.prev_close_price??d.previous_close??d.open_price??d.open);
  return {price,changePct:price&&prev?((price-prev)/prev)*100:null,source:'Gold API',timestamp:d.updatedAt||d.timestamp||new Date().toISOString()};
}
async function fetchDxy(){
  const url='https://stooq.com/q/l/?s=dx.f&f=sd2t2ohlcv&h&e=csv';
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`DXY source ${r.status}`);
  const text=await r.text(),lines=text.trim().split(/\r?\n/);
  if(lines.length<2)throw new Error('DXY quote unavailable');
  const keys=lines[0].split(','),vals=lines[1].split(','),row=Object.fromEntries(keys.map((k,i)=>[k.trim().toLowerCase(),vals[i]]));
  const price=num(row.close),open=num(row.open);
  return {price,changePct:price&&open?((price-open)/open)*100:null,source:'Stooq DX futures',timestamp:`${row.date||''}T${row.time||'00:00:00'}Z`};
}
export async function onRequestGet({env}){
  let stale=null;
  if(env.GH_MARKET_DATA) stale=await env.GH_MARKET_DATA.get(CACHE_KEY,{type:'json'});
  try{
    const [g,d]=await Promise.allSettled([fetchGold(),fetchDxy()]);
    const out={gold:g.status==='fulfilled'?g.value:stale?.gold||null,dxy:d.status==='fulfilled'?d.value:stale?.dxy||null,updatedAt:new Date().toISOString(),partial:g.status==='rejected'||d.status==='rejected'};
    if(!out.gold&&!out.dxy)throw new Error('All quote sources unavailable');
    if(env.GH_MARKET_DATA)await env.GH_MARKET_DATA.put(CACHE_KEY,JSON.stringify(out),{expirationTtl:300});
    return json(out);
  }catch(e){if(stale)return json({...stale,stale:true,error:e.message});return json({error:e.message},503);}
}
