const API='https://analyticsdata.googleapis.com/v1beta';
const te=new TextEncoder();
const b64u=(v)=>btoa(String.fromCharCode(...new Uint8Array(v))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function pemBytes(pem){const s=pem.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function token(env){
 const now=Math.floor(Date.now()/1000), head=b64u(te.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))), payload=b64u(te.encode(JSON.stringify({iss:env.GA4_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
 const key=await crypto.subtle.importKey('pkcs8',pemBytes(env.GA4_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,te.encode(head+'.'+payload)));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+payload+'.'+sig})});
 if(!r.ok) throw new Error('OAuth '+r.status+': '+await r.text()); return (await r.json()).access_token;
}
async function report(env,t,body){const r=await fetch(`${API}/properties/${env.GA4_PROPERTY_ID}:runReport`,{method:'POST',headers:{authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('GA4 '+r.status+': '+await r.text());return r.json();}
const range=(days)=>[{startDate:`${Math.max(1,Math.min(90,days||7))}daysAgo`,endDate:'today'}];
const rows=(j)=> (j.rows||[]).map(r=>({d:(r.dimensionValues||[]).map(x=>x.value),m:(r.metricValues||[]).map(x=>Number(x.value||0))}));
export async function onRequestGet({request,env}){
 try{
  if(!env.GA4_PROPERTY_ID||!env.GA4_CLIENT_EMAIL||!env.GA4_PRIVATE_KEY) return Response.json({ok:false,error:'Missing GA4 Cloudflare environment variables.'},{status:500});
  if(env.DASHBOARD_KEY && request.headers.get('x-dashboard-key')!==env.DASHBOARD_KEY) return Response.json({ok:false,error:'Unauthorized'},{status:401});
  const u=new URL(request.url), days=Number(u.searchParams.get('days')||7), dateRanges=range(days), t=await token(env);
  const [summary,source,country,device,buttons,pages,events,daily]=await Promise.all([
   report(env,t,{dateRanges,metrics:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'keyEvents'},{name:'averageSessionDuration'}]}),
   report(env,t,{dateRanges,dimensions:[{name:'sessionSourceMedium'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'keyEvents'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:12}),
   report(env,t,{dateRanges,dimensions:[{name:'country'}],metrics:[{name:'activeUsers'},{name:'keyEvents'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:10}),
   report(env,t,{dateRanges,dimensions:[{name:'deviceCategory'}],metrics:[{name:'activeUsers'},{name:'keyEvents'}]}),
   report(env,t,{dateRanges,dimensions:[{name:'customEvent:button_location'}],metrics:[{name:'eventCount'}],dimensionFilter:{filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'whatsapp_click'}}},orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:12}),
   report(env,t,{dateRanges,dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'},{name:'keyEvents'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:12}),
   report(env,t,{dateRanges,dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'},{name:'totalUsers'}],dimensionFilter:{orGroup:{expressions:['session_start','scroll','section_view','gallery_open','video_play','whatsapp_click'].map(value=>({filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value}}}))}},orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:20}),
   report(env,t,{dateRanges,dimensions:[{name:'date'}],metrics:[{name:'activeUsers'},{name:'keyEvents'}],orderBys:[{dimension:{dimensionName:'date'}}]})
  ]);
  return Response.json({ok:true,days,summary:rows(summary)[0]||{d:[],m:[0,0,0,0,0]},source:rows(source),country:rows(country),device:rows(device),buttons:rows(buttons),pages:rows(pages),events:rows(events),daily:rows(daily),generatedAt:new Date().toISOString()},{headers:{'cache-control':'private, max-age=300'}});
 }catch(e){return Response.json({ok:false,error:String(e.message||e)},{status:500});}
}
