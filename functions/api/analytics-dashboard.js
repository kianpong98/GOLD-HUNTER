const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json;charset=UTF-8',
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'
}});

const b64url=input=>{
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):input;
  let binary='';
  for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const pemToBuf=pem=>{
  const body=String(pem||'').replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s/g,'');
  if(!body)throw new Error('GA4_PRIVATE_KEY is empty or invalid');
  return Uint8Array.from(atob(body),c=>c.charCodeAt(0)).buffer;
};

async function accessToken(env){
  const now=Math.floor(Date.now()/1000);
  const enc=value=>b64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned=`${enc({alg:'RS256',typ:'JWT'})}.${enc({
    iss:env.GA4_CLIENT_EMAIL,
    scope:'https://www.googleapis.com/auth/analytics.readonly',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600
  })}`;
  const key=await crypto.subtle.importKey('pkcs8',pemToBuf(env.GA4_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error_description||data.error||`Google OAuth failed (${response.status})`);
  return data.access_token;
}

async function gaRequest(env,token,method,body){
  const response=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:${method}`,{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error?.message||`${method} failed (${response.status})`);
  return data;
}
const runReport=(env,token,body)=>gaRequest(env,token,'runReport',body);
const runRealtime=(env,token,body)=>gaRequest(env,token,'runRealtimeReport',body);
const rows=data=>(data?.rows||[]).map(row=>({
  dimensions:(row.dimensionValues||[]).map(v=>v.value||''),
  metrics:(row.metricValues||[]).map(v=>Number(v.value||0))
}));
const metric=(data,index=0)=>rows(data)[0]?.metrics?.[index]||0;
const dateRange=(startDate,endDate='today')=>[{startDate,endDate}];
const exactEvent=name=>({filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:name,caseSensitive:false}}});

async function safe(label,fn,diagnostics){
  try{return await fn();}
  catch(error){diagnostics.push({report:label,error:String(error?.message||error)});return null;}
}

function overview(data={}){
  const m=rows(data)[0]?.metrics||[];
  return {activeUsers:m[0]||0,sessions:m[1]||0,pageViews:m[2]||0,engagedSessions:m[3]||0,engagementRate:m[4]||0,avgSessionSeconds:Math.round(m[5]||0),eventCount:m[6]||0};
}

export async function onRequestOptions(){
  return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'x-admin-pin,content-type','access-control-max-age':'86400'}});
}

export async function onRequestGet({request,env}){
  if(!env.ADMIN_PIN||request.headers.get('x-admin-pin')!==env.ADMIN_PIN)return json({error:'Unauthorized'},401);
  const missing=['GA4_PROPERTY_ID','GA4_CLIENT_EMAIL','GA4_PRIVATE_KEY'].filter(k=>!env[k]);
  if(missing.length)return json({configured:false,status:'not-configured',missing,message:`Missing Cloudflare secrets: ${missing.join(', ')}`});

  const diagnostics=[];
  try{
    const token=await accessToken(env);
    const standardMetrics=[{name:'activeUsers'},{name:'sessions'},{name:'screenPageViews'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'eventCount'}];
    const [today,yesterday,seven,thirty,topPages,traffic,devices,countries,waToday,waSeven,waThirty,realtime,realtimePages,realtimeCountries,realtimeDevices,topEvents,topSections,topButtons,topNews,scrollDepth]=await Promise.all([
      safe('overviewToday',()=>runReport(env,token,{dateRanges:dateRange('today'),metrics:standardMetrics}),diagnostics),
      safe('overviewYesterday',()=>runReport(env,token,{dateRanges:dateRange('yesterday','yesterday'),metrics:standardMetrics}),diagnostics),
      safe('overview7Days',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),metrics:standardMetrics}),diagnostics),
      safe('overview30Days',()=>runReport(env,token,{dateRanges:dateRange('30daysAgo'),metrics:standardMetrics}),diagnostics),
      safe('topPages',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'pagePath'},{name:'pageTitle'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'},{name:'averageSessionDuration'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:12}),diagnostics),
      safe('trafficSources',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'engagedSessions'}],orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:12}),diagnostics),
      safe('devices',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'deviceCategory'}],metrics:[{name:'activeUsers'},{name:'sessions'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:8}),diagnostics),
      safe('countries',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'country'}],metrics:[{name:'activeUsers'},{name:'sessions'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:10}),diagnostics),
      safe('whatsappToday',()=>runReport(env,token,{dateRanges:dateRange('today'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}),diagnostics),
      safe('whatsapp7Days',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}),diagnostics),
      safe('whatsapp30Days',()=>runReport(env,token,{dateRanges:dateRange('30daysAgo'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}),diagnostics),
      safe('realtime',()=>runRealtime(env,token,{metrics:[{name:'activeUsers'}]}),diagnostics),
      safe('realtimePages',()=>runRealtime(env,token,{dimensions:[{name:'unifiedScreenName'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}),diagnostics),
      safe('realtimeCountries',()=>runRealtime(env,token,{dimensions:[{name:'country'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}),diagnostics),
      safe('realtimeDevices',()=>runRealtime(env,token,{dimensions:[{name:'deviceCategory'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}),diagnostics),
      safe('topEvents',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:15}),diagnostics),
      safe('topSections',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:page_section'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('section_view'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:12}),diagnostics),
      safe('topButtons',()=>runReport(env,token,{dateRanges:dateRange('30daysAgo'),dimensions:[{name:'customEvent:button_location'}],metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:10}),diagnostics),
      safe('topNews',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:news_type'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('news_interest'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:10}),diagnostics),
      safe('scrollDepth',()=>runReport(env,token,{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:percent_scrolled'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('scroll_depth'),orderBys:[{dimension:{dimensionName:'customEvent:percent_scrolled',orderType:'NUMERIC'}}],limit:10}),diagnostics)
    ]);

    const todayOverview=overview(today), yesterdayOverview=overview(yesterday), sevenOverview=overview(seven), thirtyOverview=overview(thirty);
    const whatsapp={today:metric(waToday),sevenDays:metric(waSeven),thirtyDays:metric(waThirty)};
    whatsapp.conversionToday=todayOverview.activeUsers?Number((whatsapp.today/todayOverview.activeUsers*100).toFixed(1)):0;
    whatsapp.conversion7Days=sevenOverview.activeUsers?Number((whatsapp.sevenDays/sevenOverview.activeUsers*100).toFixed(1)):0;

    return json({
      configured:true,
      connected:true,
      status:diagnostics.length?'connected-with-warnings':'connected',
      propertyId:String(env.GA4_PROPERTY_ID),
      updatedAt:new Date().toISOString(),
      overview:{today:todayOverview,yesterday:yesterdayOverview,sevenDays:sevenOverview,thirtyDays:thirtyOverview},
      whatsapp,
      realtime:{activeUsers:metric(realtime),topPages:rows(realtimePages),countries:rows(realtimeCountries),devices:rows(realtimeDevices)},
      topPages:rows(topPages),
      trafficSources:rows(traffic),
      devices:rows(devices),
      countries:rows(countries),
      topEvents:rows(topEvents),
      topSections:rows(topSections),
      topButtons:rows(topButtons),
      topNews:rows(topNews),
      scrollDepth:rows(scrollDepth),
      diagnostics,
      customDefinitionsRequired:diagnostics.filter(x=>/customEvent:|custom dimension|not a valid dimension/i.test(x.error)).map(x=>x.report)
    });
  }catch(error){
    return json({configured:true,connected:false,status:'error',error:String(error?.message||error),updatedAt:new Date().toISOString()},502);
  }
}
