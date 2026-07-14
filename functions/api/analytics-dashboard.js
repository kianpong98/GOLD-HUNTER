const VERSION='ga4-data-api-1.2-private-key-normalizer';
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
const normalizePrivateKey=value=>{
  let raw=String(value||'').replace(/^\uFEFF/,'').trim();
  if(!raw)throw new Error('GA4_PRIVATE_KEY is empty');

  // Accept an accidentally pasted full service-account JSON object.
  if(raw.startsWith('{')){
    try{
      const parsed=JSON.parse(raw);
      if(parsed?.private_key)raw=String(parsed.private_key);
    }catch{}
  }

  // Accept a JSON-quoted private_key value, with or without a trailing comma.
  raw=raw.replace(/,\s*$/,'').trim();
  if(raw.startsWith('\"')&&raw.endsWith('\"')){
    try{raw=JSON.parse(raw);}catch{raw=raw.slice(1,-1);}
  }

  return String(raw)
    .replace(/\\r\\n/g,'\n')
    .replace(/\\n/g,'\n')
    .replace(/\r\n/g,'\n')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .trim();
};

const pemToBuf=pem=>{
  const normalized=normalizePrivateKey(pem);
  if(!normalized.includes('-----BEGIN PRIVATE KEY-----')||!normalized.includes('-----END PRIVATE KEY-----')){
    throw new Error('GA4_PRIVATE_KEY must include BEGIN PRIVATE KEY and END PRIVATE KEY');
  }
  const body=normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g,'')
    .replace(/-----END PRIVATE KEY-----/g,'')
    .replace(/\s/g,'');
  if(!body||body.length<1000)throw new Error('GA4_PRIVATE_KEY appears incomplete');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(body))throw new Error('GA4_PRIVATE_KEY contains invalid characters');
  if(body.length%4!==0)throw new Error('GA4_PRIVATE_KEY has invalid base64 length');
  try{return Uint8Array.from(atob(body),c=>c.charCodeAt(0)).buffer;}
  catch{throw new Error('GA4_PRIVATE_KEY could not be decoded');}
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
  const text=await response.text();
  let data={}; try{data=JSON.parse(text);}catch{}
  if(!response.ok)throw new Error(data.error_description||data.error||`Google OAuth failed (${response.status})`);
  if(!data.access_token)throw new Error('Google OAuth returned no access token');
  return data.access_token;
}

async function googlePost(url,token,body){
  const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const text=await response.text();
  let data={}; try{data=JSON.parse(text);}catch{}
  if(!response.ok)throw new Error(data.error?.message||`Google API failed (${response.status})`);
  return data;
}
async function batchReports(env,token,requests){
  return googlePost(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:batchRunReports`,token,{requests});
}
async function realtimeReport(env,token,body){
  return googlePost(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runRealtimeReport`,token,body);
}
const rows=data=>(data?.rows||[]).map(row=>({dimensions:(row.dimensionValues||[]).map(v=>v.value||''),metrics:(row.metricValues||[]).map(v=>Number(v.value||0))}));
const metric=(data,index=0)=>rows(data)[0]?.metrics?.[index]||0;
const dateRange=(startDate,endDate='today')=>[{startDate,endDate}];
const exactEvent=name=>({filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:name,caseSensitive:false}}});
function overview(data={}){const m=rows(data)[0]?.metrics||[];return {activeUsers:m[0]||0,sessions:m[1]||0,pageViews:m[2]||0,engagedSessions:m[3]||0,engagementRate:m[4]||0,avgSessionSeconds:Math.round(m[5]||0),eventCount:m[6]||0};}

export async function onRequestOptions(){return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'x-admin-pin,content-type','access-control-max-age':'86400'}});}

export async function onRequestGet({request,env}){
  if(!env.ADMIN_PIN||request.headers.get('x-admin-pin')!==env.ADMIN_PIN)return json({error:'Unauthorized'},401);
  const missing=['GA4_PROPERTY_ID','GA4_CLIENT_EMAIL','GA4_PRIVATE_KEY'].filter(k=>!env[k]);
  if(missing.length)return json({configured:false,status:'not-configured',version:VERSION,missing,message:`Missing Cloudflare secrets: ${missing.join(', ')}`});

  const diagnostics=[];
  const reports={};
  try{
    const token=await accessToken(env);
    const standardMetrics=[{name:'activeUsers'},{name:'sessions'},{name:'screenPageViews'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'eventCount'}];
    const definitions=[
      ['today',{dateRanges:dateRange('today'),metrics:standardMetrics}],
      ['yesterday',{dateRanges:dateRange('yesterday','yesterday'),metrics:standardMetrics}],
      ['seven',{dateRanges:dateRange('7daysAgo'),metrics:standardMetrics}],
      ['thirty',{dateRanges:dateRange('30daysAgo'),metrics:standardMetrics}],
      ['topPages',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'pagePath'},{name:'pageTitle'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'},{name:'averageSessionDuration'}],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:12}],
      ['traffic',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'sessionDefaultChannelGroup'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'engagedSessions'}],orderBys:[{metric:{metricName:'sessions'},desc:true}],limit:12}],
      ['devices',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'deviceCategory'}],metrics:[{name:'activeUsers'},{name:'sessions'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:8}],
      ['countries',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'country'}],metrics:[{name:'activeUsers'},{name:'sessions'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:10}],
      ['waToday',{dateRanges:dateRange('today'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}],
      ['waSeven',{dateRanges:dateRange('7daysAgo'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}],
      ['waThirty',{dateRanges:dateRange('30daysAgo'),metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click')}],
      ['topEvents',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:15}],
      ['topSections',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:page_section'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('section_view'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:12}],
      ['topButtons',{dateRanges:dateRange('30daysAgo'),dimensions:[{name:'customEvent:button_location'}],metrics:[{name:'eventCount'}],dimensionFilter:exactEvent('whatsapp_click'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:10}],
      ['topNews',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:news_type'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('news_interest'),orderBys:[{metric:{metricName:'eventCount'},desc:true}],limit:10}],
      ['scrollDepth',{dateRanges:dateRange('7daysAgo'),dimensions:[{name:'customEvent:percent_scrolled'}],metrics:[{name:'eventCount'},{name:'activeUsers'}],dimensionFilter:exactEvent('scroll_depth'),limit:10}]
    ];

    // GA4 allows up to 5 reports per batch. Run batches sequentially to stay below
    // Cloudflare's simultaneous outbound connection limit.
    for(let i=0;i<definitions.length;i+=5){
      const chunk=definitions.slice(i,i+5);
      try{
        const data=await batchReports(env,token,chunk.map(x=>x[1]));
        const returned=data.reports||[];
        chunk.forEach((x,index)=>{reports[x[0]]=returned[index]||null;});
      }catch(error){
        chunk.forEach(x=>{reports[x[0]]=null;diagnostics.push({report:x[0],error:String(error?.message||error)});});
      }
    }

    const realtime={};
    const realtimeDefs=[
      ['summary',{metrics:[{name:'activeUsers'}]}],
      ['pages',{dimensions:[{name:'unifiedScreenName'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}],
      ['countries',{dimensions:[{name:'country'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}],
      ['devices',{dimensions:[{name:'deviceCategory'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:5}]
    ];
    for(const [name,body] of realtimeDefs){
      try{realtime[name]=await realtimeReport(env,token,body);}catch(error){realtime[name]=null;diagnostics.push({report:`realtime-${name}`,error:String(error?.message||error)});}
    }

    const todayOverview=overview(reports.today),yesterdayOverview=overview(reports.yesterday),sevenOverview=overview(reports.seven),thirtyOverview=overview(reports.thirty);
    const whatsapp={today:metric(reports.waToday),sevenDays:metric(reports.waSeven),thirtyDays:metric(reports.waThirty)};
    whatsapp.conversionToday=todayOverview.activeUsers?Number((whatsapp.today/todayOverview.activeUsers*100).toFixed(1)):0;
    whatsapp.conversion7Days=sevenOverview.activeUsers?Number((whatsapp.sevenDays/sevenOverview.activeUsers*100).toFixed(1)):0;

    return json({
      configured:true,connected:true,status:diagnostics.length?'connected-with-warnings':'connected',version:VERSION,
      propertyId:String(env.GA4_PROPERTY_ID),updatedAt:new Date().toISOString(),
      overview:{today:todayOverview,yesterday:yesterdayOverview,sevenDays:sevenOverview,thirtyDays:thirtyOverview},
      whatsapp,
      realtime:{activeUsers:metric(realtime.summary),topPages:rows(realtime.pages),countries:rows(realtime.countries),devices:rows(realtime.devices)},
      topPages:rows(reports.topPages),trafficSources:rows(reports.traffic),devices:rows(reports.devices),countries:rows(reports.countries),topEvents:rows(reports.topEvents),topSections:rows(reports.topSections),topButtons:rows(reports.topButtons),topNews:rows(reports.topNews),scrollDepth:rows(reports.scrollDepth),
      diagnostics,
      customDefinitionsRequired:diagnostics.filter(x=>/customEvent:|custom dimension|not a valid dimension/i.test(x.error)).map(x=>x.report)
    });
  }catch(error){
    console.error('GA4 dashboard fatal error',error);
    return json({configured:true,connected:false,status:'error',version:VERSION,error:String(error?.message||error),updatedAt:new Date().toISOString()},500);
  }
}
