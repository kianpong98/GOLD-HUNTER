const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}});
const b64url=input=>btoa(String.fromCharCode(...new Uint8Array(input))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pemToBuf=pem=>Uint8Array.from(atob(pem.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0)).buffer;
async function token(env){
  const now=Math.floor(Date.now()/1000),header=b64url(new TextEncoder().encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),payload=b64url(new TextEncoder().encode(JSON.stringify({iss:env.GA4_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}))),unsigned=`${header}.${payload}`;
  const key=await crypto.subtle.importKey('pkcs8',pemToBuf(env.GA4_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${sig}`})});
  const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.error||'GA4 token failed');return d.access_token;
}
async function report(env,body){const t=await token(env),r=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,{method:'POST',headers:{authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error?.message||'GA4 report failed');return d;}
const rows=d=>(d.rows||[]).map(r=>({dimensions:(r.dimensionValues||[]).map(x=>x.value),metrics:(r.metricValues||[]).map(x=>Number(x.value||0))}));
export async function onRequestGet({request,env}){
  if(!env.ADMIN_PIN||request.headers.get('x-admin-pin')!==env.ADMIN_PIN)return json({error:'Unauthorized'},401);
  if(!env.GA4_PROPERTY_ID||!env.GA4_CLIENT_EMAIL||!env.GA4_PRIVATE_KEY)return json({configured:false,message:'Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY in Cloudflare Production variables.'});
  try{
    const [overview,pages,sources,whatsapp,news]=await Promise.all([
      report(env,{dateRanges:[{startDate:'today',endDate:'today'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'screenPageViews'},{name:'averageSessionDuration'},{name:'eventCount'}]}),
      report(env,{dateRanges:[{startDate:'7daysAgo',endDate:'today'}],dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'},{name:'averageSessionDuration'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:8}),
      report(env,{dateRanges:[{startDate:'7daysAgo',endDate:'today'}],dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'activeUsers'},{name:'sessions'}],orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:8}),
      report(env,{dateRanges:[{startDate:'today',endDate:'today'}],dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],dimensionFilter:{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'whatsapp_click'}}}}),
      report(env,{dateRanges:[{startDate:'7daysAgo',endDate:'today'}],dimensions:[{name:'customEvent:news_type'}],metrics:[{name:'eventCount'}],dimensionFilter:{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'news_interest'}}},orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:8}).catch(()=>({rows:[]}))
    ]);
    const o=rows(overview)[0]?.metrics||[];return json({configured:true,updatedAt:new Date().toISOString(),overview:{activeUsers:o[0]||0,sessions:o[1]||0,pageViews:o[2]||0,avgSessionSeconds:Math.round(o[3]||0),events:o[4]||0,whatsappClicks:rows(whatsapp)[0]?.metrics?.[0]||0},topPages:rows(pages),trafficSources:rows(sources),topNews:rows(news)});
  }catch(e){return json({configured:true,error:e.message},502)}
}
