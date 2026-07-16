const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, no-cache, must-revalidate, max-age=0'
};

function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
function authorized(request,env){
  const expected=String(env.ADMIN_PIN||'');
  const supplied=String(request.headers.get('x-admin-pin')||'');
  return Boolean(expected&&supplied&&expected===supplied);
}
function recentMissing(events){
  const now=Date.now();
  const sixHours=6*60*60*1000;
  return (Array.isArray(events)?events:[]).filter(event=>{
    const releaseAt=Date.parse(String(event?.datetime||''));
    if(!Number.isFinite(releaseAt)||releaseAt>now||now-releaseAt>sixHours)return false;
    if(event?.eventOnly)return false;
    return !String(event?.actual||'').trim();
  }).map(event=>({
    id:String(event.id||''),
    type:String(event.type||''),
    name:String(event.name||event.type||''),
    releasePeriod:String(event.releasePeriod||''),
    datetime:String(event.datetime||''),
    status:String(event.status||'Awaiting official result')
  }));
}
async function readLive(origin,pin){
  const response=await fetch(`${origin}/api/data-engine?recovery=${Date.now()}`,{
    headers:{'x-admin-pin':pin,'cache-control':'no-cache'},
    cf:{cacheTtl:0,cacheEverything:false}
  });
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok)throw new Error(payload.error||`Data Engine HTTP ${response.status}`);
  return payload;
}
async function dispatchWatcher(env,missing){
  const token=String(env.GITHUB_ACTION_TOKEN||'').trim();
  const repo=String(env.GITHUB_REPO||'').trim();
  const ref=String(env.GITHUB_BRANCH||'main').trim()||'main';
  if(!token||!repo){
    return {dispatched:false,configured:false,error:'Set GITHUB_ACTION_TOKEN and GITHUB_REPO in Cloudflare Pages environment variables to enable one-tap recovery.'};
  }
  const types=[...new Set(missing.map(item=>item.type).filter(Boolean))].join(',');
  const url=`https://api.github.com/repos/${repo}/actions/workflows/actual-release-watcher.yml/dispatches`;
  const response=await fetch(url,{
    method:'POST',
    headers:{
      authorization:`Bearer ${token}`,
      accept:'application/vnd.github+json',
      'content-type':'application/json',
      'user-agent':'Gold-Hunter-Admin-Recovery',
      'x-github-api-version':'2022-11-28'
    },
    body:JSON.stringify({ref,inputs:{event_types:types,force_poll:'true'}})
  });
  if(response.status!==204){
    const text=await response.text();
    return {dispatched:false,configured:true,error:`GitHub dispatch failed (${response.status}): ${text.slice(0,300)}`};
  }
  return {dispatched:true,configured:true,types,ref};
}

export async function onRequestGet({request,env}){
  if(!authorized(request,env))return reply({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);
  try{
    const origin=new URL(request.url).origin;
    const pin=String(request.headers.get('x-admin-pin')||'');
    const payload=await readLive(origin,pin);
    const missing=recentMissing(payload.events);
    return reply({ok:true,checkedAt:new Date().toISOString(),missing,ready:missing.length===0,engineVersion:payload.engineVersion||''});
  }catch(error){
    return reply({error:error?.message||String(error)},500);
  }
}

export async function onRequestPost({request,env}){
  if(!authorized(request,env))return reply({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);
  try{
    const origin=new URL(request.url).origin;
    const pin=String(request.headers.get('x-admin-pin')||'');
    const payload=await readLive(origin,pin);
    const missing=recentMissing(payload.events);
    if(!missing.length){
      return reply({ok:true,ready:true,dispatched:false,message:'No recently released news is missing Actual. The live payload is already complete.',checkedAt:new Date().toISOString()});
    }
    const dispatch=await dispatchWatcher(env,missing);
    return reply({
      ok:dispatch.dispatched,
      ready:false,
      missing,
      ...dispatch,
      message:dispatch.dispatched
        ?'Automatic GitHub Actual Engine recovery started. Admin can stay open on a phone; status will be checked automatically.'
        :'The current GitHub snapshot was reconciled, but one-tap GitHub recovery is not configured.'
    },dispatch.dispatched?202:503);
  }catch(error){
    return reply({error:error?.message||String(error)},500);
  }
}
