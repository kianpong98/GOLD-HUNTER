const CACHE_KEY='market-snapshot-v3';
const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'cache-control':'public, max-age=1, s-maxage=2','x-content-type-options':'nosniff'}});
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const validGold=n=>Number.isFinite(n)&&n>500&&n<20000;
const validDxy=n=>Number.isFinite(n)&&n>50&&n<200;

async function yahooQuote(symbol,kind){
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const r=await fetch(u,{headers:{accept:'application/json','user-agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`Yahoo ${symbol} ${r.status}`);
  const d=await r.json(),res=d?.chart?.result?.[0],meta=res?.meta||{};
  const closes=res?.indicators?.quote?.[0]?.close||[];
  const price=num(meta.regularMarketPrice??[...closes].reverse().find(v=>num(v)!==null));
  const prev=num(meta.chartPreviousClose??meta.previousClose??meta.regularMarketPreviousClose);
  const valid=kind==='gold'?validGold(price):validDxy(price);
  if(!valid)throw new Error(`Invalid ${kind} quote`);
  return {price,changePct:prev?((price-prev)/prev)*100:null,source:`Yahoo Finance ${symbol}`,timestamp:meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():new Date().toISOString(),delayed:true};
}
async function goldApi(){
  const r=await fetch('https://api.gold-api.com/price/XAU',{headers:{accept:'application/json'}});
  if(!r.ok)throw new Error(`Gold API ${r.status}`);
  const d=await r.json();
  const price=num(d.price??d.value??d.ask??d.mid),prev=num(d.prev_close_price??d.previous_close??d.open_price??d.open);
  if(!validGold(price))throw new Error('Invalid Gold API quote');
  return {price,changePct:prev?((price-prev)/prev)*100:null,source:'Gold API',timestamp:d.updatedAt||d.timestamp||new Date().toISOString(),delayed:true};
}
async function stooqDxy(){
  const r=await fetch('https://stooq.com/q/l/?s=dx.f&f=sd2t2ohlcv&h&e=csv',{headers:{'user-agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error(`Stooq ${r.status}`);
  const lines=(await r.text()).trim().split(/\r?\n/);if(lines.length<2)throw new Error('DXY CSV unavailable');
  const keys=lines[0].split(','),vals=lines[1].split(','),row=Object.fromEntries(keys.map((k,i)=>[k.trim().toLowerCase(),vals[i]]));
  const price=num(row.close),open=num(row.open);if(!validDxy(price))throw new Error('Invalid DXY quote');
  return {price,changePct:open?((price-open)/open)*100:null,source:'Stooq DX futures',timestamp:`${row.date||''}T${row.time||'00:00:00'}Z`,delayed:true};
}
async function firstSuccess(tasks){
  const errors=[];
  for(const task of tasks){try{return await task()}catch(e){errors.push(e.message)}}
  throw new Error(errors.join(' | '));
}
export async function onRequestGet({env}){
  let stale=null;
  if(env.GH_MARKET_DATA){try{stale=await env.GH_MARKET_DATA.get(CACHE_KEY,{type:'json'})}catch{}}
  const [g,d]=await Promise.allSettled([
    firstSuccess([()=>yahooQuote('GC=F','gold'),goldApi]),
    firstSuccess([()=>yahooQuote('DX-Y.NYB','dxy'),stooqDxy])
  ]);
  const now=new Date().toISOString();
  const out={
    gold:g.status==='fulfilled'?g.value:stale?.gold||null,
    dxy:d.status==='fulfilled'?d.value:stale?.dxy||null,
    updatedAt:now,
    partial:g.status==='rejected'||d.status==='rejected',
    errors:{gold:g.status==='rejected'?g.reason?.message:null,dxy:d.status==='rejected'?d.reason?.message:null}
  };
  if(!out.gold&&!out.dxy)return json({error:'All quote sources unavailable',...out},503);
  if(env.GH_MARKET_DATA){try{await env.GH_MARKET_DATA.put(CACHE_KEY,JSON.stringify(out),{expirationTtl:604800})}catch{}}
  return json(out);
}
