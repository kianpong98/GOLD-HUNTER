const KEY='market-admin-forecast-overrides-v3';

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate, max-age=0',
    'cdn-cache-control':'no-store',
    'cloudflare-cdn-cache-control':'no-store'
  }});
}
function authorized(request,env){
  const expected=String(env.ADMIN_PIN||'').trim();
  const supplied=String(request.headers.get('x-admin-pin')||'').trim();
  return Boolean(expected&&supplied&&expected===supplied);
}
function clean(v,n=100){return String(v??'').trim().slice(0,n);}
function canonicalType(v){return clean(v?.type||v,80).toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');}
function eventKeys(e){
  const id=clean(e?.id,120), type=canonicalType(e), period=clean(e?.releasePeriod,30);
  return [id,type&&period?`${type}|${period}`:''].filter(Boolean);
}

export async function onRequestOptions(){return new Response(null,{status:204,headers:{'allow':'GET,POST,OPTIONS','cache-control':'no-store'}});}

export async function onRequestGet({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);
  if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.'},503);
  const overrides=await env.GH_MARKET_DATA.get(KEY,{type:'json'})||{};
  return json({ok:true,overrides,updatedAt:overrides.__updatedAt||null});
}

export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);
  if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.'},503);
  let body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
  const rows=Array.isArray(body?.events)?body.events:[];
  if(!rows.length)return json({error:'No events supplied.'},400);
  const current=await env.GH_MARKET_DATA.get(KEY,{type:'json'})||{};
  const next={...current};
  delete next.__updatedAt;
  let count=0;
  for(const e of rows){
    const value=clean(e?.forecast,80);
    const keys=eventKeys(e);
    if(!keys.length)continue;
    for(const key of keys)next[key]=value;
    count++;
  }
  next.__updatedAt=new Date().toISOString();
  await env.GH_MARKET_DATA.put(KEY,JSON.stringify(next));
  const verify=await env.GH_MARKET_DATA.get(KEY,{type:'json'})||{};
  const mismatch=rows.find(e=>eventKeys(e).some(k=>String(verify[k]??'')!==clean(e?.forecast,80)));
  if(mismatch)return json({error:`KV verification failed for ${clean(mismatch.name||mismatch.id,120)}.`},500);
  return json({ok:true,count,updatedAt:verify.__updatedAt,overrides:verify});
}
