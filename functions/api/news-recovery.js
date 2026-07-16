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
async function reconcileNow(origin,pin){
  let lastPayload=null;
  let lastError='';
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(`${origin}/api/data-engine?force=1&reconcile=${Date.now()}-${attempt}`,{
        headers:{'x-admin-pin':pin,'cache-control':'no-cache','pragma':'no-cache'},
        cf:{cacheTtl:0,cacheEverything:false}
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||`Data Engine HTTP ${response.status}`);
      lastPayload=payload;
      const missing=recentMissing(payload.events);
      if(!missing.length)return {reconciled:true,ready:true,missing:[],attempts:attempt,engineVersion:payload.engineVersion||''};
      lastError=`Still waiting for ${missing.map(item=>item.name).join(', ')}`;
    }catch(error){lastError=error?.message||String(error);}
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1200));
  }
  return {reconciled:Boolean(lastPayload),ready:false,missing:recentMissing(lastPayload?.events||[]),attempts:3,error:lastError,engineVersion:lastPayload?.engineVersion||''};
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
    const reconcile=await reconcileNow(origin,pin);
    return reply({
      ok:true,
      ready:reconcile.ready,
      missing:reconcile.missing?.length?reconcile.missing:missing,
      automaticWatcher:true,
      automaticVerification:true,
      ...reconcile,
      message:reconcile.ready
        ?'The deployed official snapshot was reconciled and the website now exposes every due Actual.'
        :'The deployed snapshot was reconciled. GitHub Actual Watcher and release self-heal continue automatically every 5 minutes; no computer or token is required.'
    },reconcile.ready?200:202);
  }catch(error){
    return reply({error:error?.message||String(error)},500);
  }
}
