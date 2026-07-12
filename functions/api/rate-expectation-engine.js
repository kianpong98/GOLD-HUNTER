const STATIC_URL='/assets/data/rate-expectation.json?v=1';
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
export async function onRequestGet({request}){
  try{
    const u=new URL(request.url);
    const r=await fetch(new URL(STATIC_URL,u.origin),{headers:{accept:'application/json'},cf:{cacheTtl:0,cacheEverything:false}});
    if(!r.ok)throw new Error(`static expectation ${r.status}`);
    const d=await r.json();
    return json(d);
  }catch(e){return json({error:'Rate expectation unavailable',detail:String(e?.message||e)},503)}
}
