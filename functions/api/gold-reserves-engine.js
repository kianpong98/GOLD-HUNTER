const STATIC_URL='/assets/data/gold-reserves.json?v=1';
const KV_KEY='central-bank-gold-reserves-v1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=1800','access-control-allow-origin':'*'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers});
function valid(d){return Array.isArray(d?.records)&&d.records.some(r=>r.country&&Number.isFinite(Number(r.holdingsTonnes)));}
export async function onRequestGet({request,env}){
  let staticData=null,kvData=null;
  try{const u=new URL(STATIC_URL,new URL(request.url).origin);const r=await fetch(u.toString(),{headers:{accept:'application/json'}});if(r.ok){const d=await r.json();if(valid(d))staticData=d;}}catch{}
  if(env.GH_MARKET_DATA){try{const d=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});if(valid(d))kvData=d;}catch{}}
  const chosen=staticData||kvData;
  if(!chosen)return json({records:[],summary:null,source:'World Gold Council / IMF IFS',sourceUrl:'https://www.gold.org/goldhub/data/gold-reserves-by-country',updatedAt:null,status:'awaiting_sync',message:'Awaiting first official monthly sync'},200);
  if(env.GH_MARKET_DATA&&staticData){try{await env.GH_MARKET_DATA.put(KV_KEY,JSON.stringify(staticData),{expirationTtl:2592000});}catch{}}
  return json({...chosen,status:'ready'});
}
