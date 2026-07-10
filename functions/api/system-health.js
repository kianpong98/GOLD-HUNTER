export async function onRequestGet({env}){
  const checks={kv:Boolean(env.GH_MARKET_DATA),adminPin:Boolean(env.ADMIN_PIN),time:new Date().toISOString()};
  return new Response(JSON.stringify({ok:true,checks}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
