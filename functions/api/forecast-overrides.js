const KEY='market-forecast-overrides-v2';
const LEGACY_KEY='market-forecast-overrides-v1';
const clean=(v,n=100)=>String(v??'').trim().slice(0,n);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0','cdn-cache-control':'no-store','cloudflare-cdn-cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-admin-pin','access-control-allow-methods':'GET,POST,OPTIONS'}});
const authorized=(request,env)=>Boolean(env.ADMIN_PIN)&&request.headers.get('x-admin-pin')===String(env.ADMIN_PIN);
export async function onRequestOptions(){return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-admin-pin','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'}})}
export async function onRequestGet({env}){
  if(!env.GH_MARKET_DATA)return json({overrides:{},updatedAt:null,configured:false});
  let payload=await env.GH_MARKET_DATA.get(KEY,{type:'json'});
  if(!payload||typeof payload!=='object'){
    const legacy=await env.GH_MARKET_DATA.get(LEGACY_KEY,{type:'json'});
    payload={overrides:(legacy&&typeof legacy==='object')?legacy:{},updatedAt:null};
  }
  return json({overrides:payload.overrides||{},updatedAt:payload.updatedAt||null,configured:true});
}
export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);
  if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.'},503);
  let body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400)}
  const input=(body&&typeof body.overrides==='object')?body.overrides:{};
  const overrides={};
  for(const [k,v] of Object.entries(input).slice(0,500)){
    const key=clean(k,160);if(!key)continue;overrides[key]=clean(v,80);
  }
  const updatedAt=new Date().toISOString();
  await env.GH_MARKET_DATA.put(KEY,JSON.stringify({overrides,updatedAt}));
  // Keep v1 synchronized for the existing data engine.
  await env.GH_MARKET_DATA.put(LEGACY_KEY,JSON.stringify(overrides));
  return json({ok:true,count:Object.keys(overrides).length,updatedAt,overrides});
}
