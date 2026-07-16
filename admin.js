(()=>{
  const API='/api/market-events'; const FED_API='/api/rate-expectation-engine'; const SYNC_INTERVAL_MS=5*60*1000; let pin='',events=[],meta={},nextSyncAt=0,autoRefreshBusy=false;
  const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusText=e=>e.eventOnly?'Event time only':e.actual?'Actual received':e.officialAuto?(e.previousStatus==='ready'?'Official connected':'Awaiting official sync'):'Manual / fallback';
  function calendarOrder(a,b){
    const ap=Boolean(a.calendarPinned||a.lifecycleStage==='recent_release'),bp=Boolean(b.calendarPinned||b.lifecycleStage==='recent_release');
    if(ap!==bp)return ap?-1:1;
    const at=new Date(a.datetime).getTime(),bt=new Date(b.datetime).getTime();
    if(ap&&bp)return bt-at;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const ad=String(a.datetime||'').slice(0,10),bd=String(b.datetime||'').slice(0,10),now=Date.now();
    const ag=ad===today?0:(at>=now?1:2),bg=bd===today?0:(bt>=now?1:2);
    if(ag!==bg)return ag-bg;
    return ag===2?bt-at:at-bt;
  }
  function visibleEvents(){const q=$('#searchInput').value.trim().toLowerCase(),f=$('#filterSelect').value,now=Date.now();return events.map((e,i)=>({e,i})).filter(({e})=>e.showOnCalendar!==false).sort((a,b)=>calendarOrder(a.e,b.e)).filter(({e})=>{
    const text=`${e.name} ${e.nameZh} ${e.type}`.toLowerCase();if(q&&!text.includes(q))return false;
    if(f==='waiting'&&!(e.previousStatus==='awaiting_official'||(e.released&&!e.actual&&!e.eventOnly)))return false;
    if(f==='missingForecast'&&(e.forecast||e.eventOnly))return false;
    if(f==='released'&&new Date(e.datetime).getTime()>now)return false;
    if(f==='upcoming'&&new Date(e.datetime).getTime()<=now)return false;return true;
  });}
  function render(){
    const rows=visibleEvents(); $('#adminEvents').innerHTML=rows.length?rows.map(({e,i})=>{
      const waiting=e.previousStatus==='awaiting_official'||(e.released&&!e.actual&&!e.eventOnly); const eventOnly=e.eventOnly;
      const last=e.lastRelease||{};
      const historyRows=(e.history||[]).slice(0,10).map((h,n)=>`<div class="history-row"><span class="history-num">${n+1}</span><label class="label">Period<input class="input locked" readonly value="${esc(h.period||'—')}"></label><label class="label">Actual<input class="input locked" readonly value="${esc(h.actual||'—')}"></label><label class="label">Previous<input class="input locked" readonly value="${esc(h.previous||'—')}"></label><label class="label">Forecast（你填写）<input class="input" data-history-period="${esc(h.period||'')}" value="${esc(h.forecast||'')}" placeholder="填写该期 Forecast"></label></div>`).join('');
      const fields=eventOnly?`<label class="label">Malaysia date & time<input class="input" data-k="datetime" type="datetime-local" value="${esc((e.datetime||'').slice(0,16))}"></label><label class="label">Status<input class="input locked" readonly value="${esc(e.status||'Scheduled')}"></label>`:`<label class="label">Malaysia date & time<input class="input" data-k="datetime" type="datetime-local" value="${esc((e.datetime||'').slice(0,16))}"></label><label class="label">Next Forecast<input class="input" data-k="forecast" value="${esc(e.forecast)}" placeholder="下一次，例如 2.8% / 180K"></label><label class="label">Previous (Automatic)<input class="input locked" readonly value="${esc(e.previous||'—')}"></label><label class="label">Actual (Official)<input class="input locked" readonly value="${esc(e.actual||'—')}"></label><details class="history-details"><summary>▶ 最近 10 次 Last Releases（点击展开）</summary><div class="history-content">${historyRows||'<p class="admin-note">官方历史记录同步后会显示在这里。</p>'}</div></details>`;
      return `<article class="event ${waiting?'waiting':'ready'}" data-i="${i}"><div class="event-head"><div><strong>${esc(e.name)}</strong><span class="zh">${esc(e.nameZh||'')} · ${esc(e.releasePeriod||'')}</span></div><div class="badges"><span class="badge">${'★'.repeat(Number(e.impact)||4)}</span><span class="badge ${waiting?'warn':'ok'}">${esc(statusText(e))}</span></div></div><div class="grid">${fields}</div></article>`;
    }).join(''):'<p class="admin-note">没有符合筛选条件的新闻。</p>';
    updateStats();
  }
  function updateStats(){const waiting=events.filter(e=>e.previousStatus==='awaiting_official'||(e.released&&!e.actual&&!e.eventOnly)).length;$('#totalCount').textContent=events.length;$('#readyCount').textContent=events.filter(e=>e.officialAuto&&e.previousStatus==='ready').length;$('#waitingCount').textContent=waiting;$('#forecastCount').textContent=events.filter(e=>e.forecast).length;
    const cs=meta.connectorSources||{};const legacy=meta.officialSources||{};
    const normalize=(key,fallback)=>cs[key]||{status:fallback?'live':'offline',lastSuccess:meta.officialUpdatedAt||null,lastChecked:meta.lastCheckedAt||meta.updatedAt||null};
    const items=[['Static Cache',normalize('staticCache',legacy.staticCache)],['BLS',normalize('bls',legacy.bls)],['FRED',normalize('fred',legacy.fred)],['Department of Labor',normalize('dol',legacy.dol)],['BEA',normalize('bea',legacy.bea)],['Federal Reserve',normalize('federalReserve',legacy.federalReserve)],['Cloudflare KV',normalize('cloudflareKv',meta.kvConfigured)]];
    const label={live:'● Connected',cached:'● Retrying / Cached',offline:'● Offline'};
    const newsHealth=Array.isArray(meta.connectionHealth)?meta.connectionHealth:[];
    $('#sourceGrid').innerHTML=newsHealth.length?newsHealth.map(v=>`<div class="source ${v.status==='live'?'ok':'bad'}"><b>${label[v.status]||label.offline}</b><strong class="source-news-name">${esc(v.name)}</strong><span class="source-provider">${esc(v.provider||'Official source')}</span><small>Last successful access: ${fmt(v.lastSuccess)}</small><small>Last poll: ${fmt(v.lastChecked)}</small><small>Last data change: ${fmt(v.lastDataChanged)}</small>${v.error?`<small class="source-error">Error: ${esc(v.error)}</small>`:''}<small class="source-recovery">${esc(v.recovery||'')}</small></div>`).join(''):items.map(([n,v])=>`<div class="source ${v.status==='live'?'ok':'bad'}"><b>${label[v.status]||label.offline}</b>${n}<small>Last checked: ${fmt(v.lastChecked||meta.lastCheckedAt||meta.updatedAt)}</small><small>Last data change: ${fmt(v.lastSuccess)}</small></div>`).join('');
    $('#syncLine').textContent=`Last checked：${fmt(meta.lastCheckedAt||meta.updatedAt)} · Last data change：${fmt(meta.lastDataChangeAt||meta.officialUpdatedAt)} · KV write protection：${meta.kvWriteProtection?.enabled?'ON (change only)':'Unknown'}${meta.officialError?' · '+meta.officialError:''}`;updateSyncMonitor(items);}
  function latestSuccess(items){const vals=items.map(([,v])=>new Date(v.lastSuccess||0).getTime()).filter(Number.isFinite);return vals.length?Math.max(...vals):0;}
  function mytClock(ts){return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ts))+' MYT';}
  function duration(ms){const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  function updateSyncMonitor(items){
    const now=Date.now(); if(!nextSyncAt||nextSyncAt<=now)nextSyncAt=Math.ceil(now/SYNC_INTERVAL_MS)*SYNC_INTERVAL_MS;
    const latest=latestSuccess(items), nonLive=items.filter(([,v])=>v.status!=='live').length;
    const points=items.map(([,v])=>v.status==='live'?100:v.status==='cached'?65:0),health=Math.round(points.reduce((a,b)=>a+b,0)/(points.length||1));
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    set('nextSyncTime',mytClock(nextSyncAt)); set('nextSyncCountdown',duration(nextSyncAt-now));
    set('lastSuccessfulSync',latest?mytClock(latest):'No record'); set('lastSuccessfulAge',latest?`${duration(now-latest)} ago`:'No record');
    set('retrySourceCount',String(nonLive)); set('lastCheckedAt',meta.lastCheckedAt?mytClock(meta.lastCheckedAt):'No record'); set('lastDataChangeAt',meta.lastDataChangeAt?mytClock(meta.lastDataChangeAt):'No record'); set('kvWriteMode',meta.kvWriteProtection?.enabled?'ON':'Unknown'); set('healthScore',`${health}%`); const bar=document.getElementById('healthBar');if(bar)bar.style.width=`${health}%`;
  }
  function tickSyncMonitor(){
    const now=Date.now(); if(nextSyncAt&&now>=nextSyncAt){nextSyncAt+=SYNC_INTERVAL_MS;if(pin&&!autoRefreshBusy){autoRefreshBusy=true;load().catch(()=>{}).finally(()=>autoRefreshBusy=false);}}
    const cs=meta.connectorSources||{},legacy=meta.officialSources||{};const normalize=(key,fallback)=>cs[key]||{status:fallback?'live':'offline',lastSuccess:meta.officialUpdatedAt||null,lastChecked:meta.lastCheckedAt||meta.updatedAt||null};
    const items=[['Static Cache',normalize('staticCache',legacy.staticCache)],['BLS',normalize('bls',legacy.bls)],['FRED',normalize('fred',legacy.fred)],['Department of Labor',normalize('dol',legacy.dol)],['BEA',normalize('bea',legacy.bea)],['Federal Reserve',normalize('federalReserve',legacy.federalReserve)],['Cloudflare KV',normalize('cloudflareKv',meta.kvConfigured)]];updateSyncMonitor(items);
  }
  const fmt=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false}):'尚无记录';
  function collect(){document.querySelectorAll('.event').forEach(card=>{const i=+card.dataset.i;card.querySelectorAll('[data-k]').forEach(input=>{if(input.disabled)return;let v=input.value.trim();const key=input.dataset.k;if(key==='datetime'&&v&&!/[zZ]|[+-]\d\d:\d\d$/.test(v))v+=':00+08:00';events[i][key]=v;});events[i].releaseForecasts=events[i].releaseForecasts||{};card.querySelectorAll('[data-history-period]').forEach(input=>{const period=input.dataset.historyPeriod;const value=input.value.trim();if(period){if(value)events[i].releaseForecasts[period]=value;else delete events[i].releaseForecasts[period];}});});}
  const metric=(v)=>Number(v||0).toLocaleString('en-US');
  const listHtml=(rows,labelIndex=0,valueIndex=0)=>rows&&rows.length?rows.map(r=>`<div class="mini-row"><span>${esc(r.dimensions?.[labelIndex]||'Unknown')}</span><b>${metric(r.metrics?.[valueIndex])}</b></div>`).join(''):'<span>No data yet</span>';


  const agoText=(value)=>{if(!value)return 'No timestamp';const ms=Date.now()-new Date(value).getTime();if(!Number.isFinite(ms))return 'Invalid time';const m=Math.max(0,Math.round(ms/60000));if(m<2)return 'Just now';if(m<60)return `${m} min ago`;const h=Math.round(m/60);if(h<48)return `${h} hr ago`;return `${Math.round(h/24)} days ago`;};
  const detailRows=(rows)=>rows.map(([k,v])=>`<div class="dc-detail-row"><span>${esc(k)}</span><b>${esc(v??'—')}</b></div>`).join('');
  function setDcCard(id,{status='Warning',tone='warn',main='—',sub='',details=[]}){const el=document.getElementById(id);if(!el)return;const st=el.querySelector('[data-role="status"]'),mn=el.querySelector('[data-role="main"]'),sb=el.querySelector('[data-role="sub"]'),dt=el.querySelector('[data-role="detail"]');st.textContent=status;st.className=`dc-status ${tone}`;mn.textContent=main;sb.textContent=sub;dt.innerHTML=detailRows(details);}
  function freshTone(value,maxMinutes){if(!value)return 'bad';const age=(Date.now()-new Date(value).getTime())/60000;if(!Number.isFinite(age))return 'bad';return age<=maxMinutes?'live':age<=maxMinutes*3?'warn':'bad';}
  function toneLabel(tone,live='Live',warn='Cached',bad='Stale'){return tone==='live'?live:tone==='warn'?warn:bad;}

  function setValue(id,value){const el=document.getElementById(id);if(el)el.value=value??'';}
  function isoToLocalInput(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;}
  function fedRowsFrom(data){const manual=data?.admin?.manualOverride;const effective=(manual&&data?.sourceMode!=='official-github-sync')?manual:data;return Array.isArray(effective?.outcomes)?effective.outcomes:[];}
  async function loadFedEditor(){
    const st=$('#fedManualStatus');
    try{
      const r=await fetch(`${FED_API}?admin=${Date.now()}`,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Fed Rate data unavailable');
      const manual=d.admin?.manualOverride||null,base=manual||d,rows=Array.isArray(base.outcomes)?base.outcomes:[];
      setValue('fedManualEnabled',base.manualEnabled===false?'false':'true');setValue('fedMeetingLabel',base.meetingLabel||'Next FOMC decision');setValue('fedMeetingDateTime',isoToLocalInput(base.meetingDateTime||base.meetingDate));setValue('fedDisplayUpdatedAt',isoToLocalInput(base.displayUpdatedAt||base.updatedAt));
      setValue('fedCurrentRange',base.currentTargetRange||'');setValue('fedSource',base.source||'');setValue('fedSourceUrl',base.sourceUrl||'');setValue('fedNote',base.note||'');
      for(let i=1;i<=4;i++){setValue(`fedRange${i}`,rows[i-1]?.targetRange||'');setValue(`fedProb${i}`,rows[i-1]?.probability??'');}
      setValue('fedEffectiveSource',d.sourceMode==='manual-admin-primary'?'Admin Manual (primary)':d.sourceMode==='official-github-sync'?'CME Official':'Verified fallback');setValue('fedLastCmeCheck',fmt(d.cmeLastCheckedAt||d.lastCheckedAt||d.updatedAt));
      const badge=$('#fedEffectiveBadge');if(badge){badge.textContent=d.sourceMode==='manual-admin-primary'?'ADMIN PRIMARY':d.sourceMode==='official-github-sync'?'CME LIVE':'FALLBACK';badge.className=`badge ${d.sourceMode==='manual-admin-primary'||d.sourceMode==='official-github-sync'?'ok':'warn'}`;}
      st.textContent=d.sourceMode==='manual-admin-primary'?'你现在拥有完整控制权；网站正在使用这里保存的日期、时间、概率和来源。':d.sourceMode==='official-github-sync'?'手动优先已关闭，网站使用 CME 自动数据。':'当前使用最后验证快照。';
    }catch(e){st.textContent=e.message;}
  }
  async function saveFedManual(){
    const st=$('#fedManualStatus'),btn=$('#saveFedManual');btn.disabled=true;st.textContent='保存并发布 Fed Rate 中…';
    const outcomes=[];for(let i=1;i<=4;i++){const targetRange=$(`#fedRange${i}`)?.value||'',probability=$(`#fedProb${i}`)?.value||'';if(targetRange||probability)outcomes.push({targetRange,probability});}
    const body={manualEnabled:$('#fedManualEnabled').value==='true',meetingLabel:$('#fedMeetingLabel').value,meetingDateTime:$('#fedMeetingDateTime').value,displayUpdatedAt:$('#fedDisplayUpdatedAt').value,currentTargetRange:$('#fedCurrentRange').value,source:$('#fedSource').value,sourceUrl:$('#fedSourceUrl').value,note:$('#fedNote').value,outcomes};
    try{const r=await fetch(`${FED_API}?save=${Date.now()}`,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'cache-control':'no-cache'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error+(d.detail?` · ${d.detail}`:''));st.textContent=d.unchanged?'内容没有变化。':'已保存并立即成为网站 Fed Rate 的有效数据。';await loadFedEditor();await loadDataHealth();}catch(e){st.textContent=e.message;}finally{btn.disabled=false;}
  }

  async function loadAnalytics(){
    const st=$('#analyticsStatus'),warnings=$('#analyticsWarnings'),badge=$('#analyticsBadge'),headline=$('#analyticsHeadline');
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
    const renderList=(id,rows,labelIndex=0,valueIndex=0,suffix='')=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=rows&&rows.length?rows.map(r=>`<div class="mini-row"><span>${esc(r.dimensions?.[labelIndex]||'Unknown')}</span><b>${metric(r.metrics?.[valueIndex])}${suffix}</b></div>`).join(''):'<span>No data yet</span>';};
    const renderRank=(id,rows,labeler=(r)=>r.dimensions?.[0]||'Unknown',valueIndex=0)=>{const el=document.getElementById(id);if(!el)return;const list=(rows||[]).filter(r=>Number(r.metrics?.[valueIndex]||0)>0),max=Math.max(1,...list.map(r=>Number(r.metrics?.[valueIndex]||0)));el.innerHTML=list.length?list.map(r=>{const value=Number(r.metrics?.[valueIndex]||0),label=labeler(r);return `<div class="wa-rank"><span class="wa-rank-label" title="${esc(label)}">${esc(label)}</span><b class="wa-rank-value">${metric(value)}</b><span class="wa-rank-track"><i style="width:${Math.max(3,value/max*100).toFixed(1)}%"></i></span></div>`;}).join(''):'<span>No data yet</span>';};
    const dateLabel=value=>{const v=String(value||'');if(!/^\d{8}$/.test(v))return v;return `${v.slice(6,8)}/${v.slice(4,6)}`;};
    try{
      const r=await fetch(`/api/analytics-dashboard?t=${Date.now()}`,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Analytics unavailable');
      if(!d.configured){st.textContent=d.message||'GA4 dashboard is not configured yet.';headline.textContent='GA4 Data API 尚未连接；网站现有追踪代码不会受影响。';badge.textContent='NOT CONFIGURED';badge.className='badge warn';return d;}
      if(d.connected===false||d.error)throw new Error(d.error||'GA4 connection failed');
      const today=d.overview?.today||{},yesterday=d.overview?.yesterday||{},seven=d.overview?.sevenDays||{},thirty=d.overview?.thirtyDays||{},wa=d.whatsapp||{},rt=d.realtime||{};
      set('aVisitors',metric(today.activeUsers));set('aYesterday',metric(yesterday.activeUsers));set('a7Days',metric(seven.activeUsers));set('a30Days',metric(thirty.activeUsers));set('aSessions',metric(today.sessions));set('aRealtime',metric(rt.activeUsers));set('aWhatsapp',metric(wa.today));set('aWa7Days',metric(wa.sevenDays));set('aWa30Days',metric(wa.thirtyDays));set('aWaUsers30',metric(wa.thirtyDayUsers));set('aConversion',`${Number(wa.conversionToday||0).toFixed(1)}%`);set('aConversion7',`${Number(wa.conversion7Days||0).toFixed(1)}%`);
      const trendEl=$('#aWaTrend'),trend=wa.trend||[],trendMax=Math.max(1,...trend.map(x=>Number(x.metrics?.[0]||0)));if(trendEl)trendEl.innerHTML=trend.length?trend.map(x=>{const count=Number(x.metrics?.[0]||0),h=Math.max(3,count/trendMax*100);return `<div class="wa-day"><div class="wa-bar-wrap"><i class="wa-bar" style="height:${h.toFixed(1)}%" data-tip="${count} clicks"></i></div><small>${esc(dateLabel(x.dimensions?.[0]))}</small></div>`;}).join(''):'<span>No WhatsApp clicks yet</span>';
      renderRank('aWaSources',wa.sources);renderRank('aButtons',d.topButtons);renderRank('aWaPages',wa.pages,r=>r.dimensions?.[1]||r.dimensions?.[0]||'Unknown');renderRank('aWaCampaigns',wa.campaigns,r=>{const v=r.dimensions?.[0]||'(not set)';return v==='(not set)'?'No UTM campaign':v;});renderRank('aSections',(d.topSections&&d.topSections.length?d.topSections:d.topSectionIds));renderRank('aScroll',d.scrollDepth);
      const ev=d.analyticsHealth?.eventCounts||{},eventUsers=d.analyticsHealth?.eventUsers||{};const funnel=[['Visitors',seven.activeUsers],['Section viewers',eventUsers.section_view||0],['Deep scrollers',eventUsers.scroll_depth||0],['WhatsApp users',wa.sevenDayUsers||0]];const funnelEl=$('#aFunnel');if(funnelEl)funnelEl.innerHTML=funnel.map(([label,value])=>`<div class="wa-funnel-step"><span>${esc(label)}</span><b>${metric(value)}</b></div>`).join('');
      renderList('aTopPages',d.topPages,0,0);renderList('aSources',d.trafficSources,0,1);renderList('aNews',d.topNews,0,0);renderList('aCountries',d.countries,0,0);renderList('aDevices',d.devices,0,0);renderList('aRealtimePages',rt.topPages,0,0);
      const topButton=d.topButtons?.[0]?.dimensions?.[0]||'No button data',topSource=wa.sources?.[0]?.dimensions?.[0]||'No WhatsApp source data';headline.textContent=`Today: ${metric(wa.today)} WA clicks · 7-day conversion: ${Number(wa.conversion7Days||0).toFixed(1)}% · Best CTA: ${topButton} · Best WA source: ${topSource}`;
      st.textContent=`GA4 updated: ${fmt(d.updatedAt)} · Property ${d.propertyId||'connected'} · Auto refresh every 5 minutes`;
      const custom=(d.customDefinitionsRequired||[]),diagnostics=(d.diagnostics||[]),health=d.analyticsHealth||{},eventCounts=health.eventCounts||{},waiting=health.waitingForProcessing||{};
      const labels={topSections:'page_section',topSectionIds:'section_id（可选）',topButtons:'button_location',topNewsNames:'news_name（建议建立）',topNewsTypes:'news_type',scrollDepth:'percent_scrolled'};
      const eventSummary=['section_view','scroll_depth','news_interest','whatsapp_click'].map(name=>`${name}: ${metric(eventCounts[name]||0)}`).join(' · ');
      const waitingItems=Object.entries(waiting).filter(([,v])=>Number(v.eventCount||0)>0&&Number(v.rows||0)===0).map(([name,v])=>`${labels[name]||name}：事件已有 ${metric(v.eventCount)} 次，但自定义维度${v.reason==='custom-definition-not-registered'?'尚未注册':'仍在处理，GA4 不回填注册前数据'}`);
      warnings.textContent=custom.length?`请建立 Event-scoped Custom definitions：${custom.map(x=>labels[x]||x).join('、')}。${waitingItems.length?' '+waitingItems.join('；'):''}`:waitingItems.length?`${waitingItems.join('；')}。新数据通常需数小时至 24 小时进入普通报表。`:diagnostics.length?`${diagnostics.length} 个非关键报表暂时不可用，其余 WhatsApp 数据正常。事件：${eventSummary}`:`WhatsApp 追踪正常：${eventSummary}`;
      warnings.className=`admin-note${warnings.textContent?' analytics-warning':''}`;badge.textContent=custom.length||diagnostics.length?'CONNECTED · WARN':'CONNECTED';badge.className=`badge ${custom.length||diagnostics.length?'warn':'ok'}`;return d;
    }catch(e){['aVisitors','aYesterday','a7Days','a30Days','aSessions','aRealtime','aWhatsapp','aWa7Days','aWa30Days','aWaUsers30','aConversion','aConversion7'].forEach(id=>set(id,'—'));st.textContent=e.message;headline.textContent='Analytics API 暂时无法读取。';warnings.textContent='请检查 GA4 Property 权限、Cloudflare Secrets 和 Google Analytics Data API。';badge.textContent='ERROR';badge.className='badge warn';throw e;}
  }
  async function loadDataHealth(){
    const nowIso=new Date().toISOString();
    const defs=[['news','Economic News','/api/market-events'],['etf','ETF Holdings','/api/etf-engine'],['fed','Fed Rate','/api/rate-expectation-engine'],['gold','Central Bank Gold','/api/gold-reserves-engine']];
    const fetchOne=async([key,name,url])=>{try{const r=await fetch(`${url}?health=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});let d={};try{d=await r.json();}catch{throw new Error(`Invalid JSON (${r.status})`);}return {key,name,url,ok:r.ok,data:d,error:r.ok?'':(d.error||`HTTP ${r.status}`)};}catch(e){return {key,name,url,ok:false,data:{},error:e.message||'Request failed'};}};
    const fetched=await Promise.all(defs.map(fetchOne));
    const by=Object.fromEntries(fetched.map(x=>[x.key,x]));
    const safe=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
    let newsTone='bad',etfTone='bad',fedTone='bad',goldTone='bad';
    let newsChecked=null,etfChecked=null,fedChecked=null,goldChecked=null;
    try{
      const x=by.news,d=x.data||{};newsChecked=d.lastCheckedAt||d.updatedAt||d.generatedAt;const changed=d.lastDataChangeAt||d.officialUpdatedAt||d.updatedAt;const next=(d.events||[]).filter(e=>Date.parse(e.datetime)>Date.now()).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime))[0];const total=(d.events||[]).length;const history=(d.events||[]).filter(e=>Array.isArray(e.history)&&e.history.length).length;newsTone=!x.ok?'bad':d.kvConfigured===false?'warn':freshTone(newsChecked,20);setDcCard('dcNews',{status:toneLabel(newsTone,'Live','Delayed','Offline'),tone:newsTone,main:`${total} events`,sub:next?`Next: ${next.name} · ${fmt(next.datetime)}`:'No upcoming event',details:[['Engine',d.engineVersion||'—'],['Last checked',fmt(newsChecked)],['Last data change',fmt(changed)],['History available',`${history}/${total}`],['Forecast filled',String((d.events||[]).filter(e=>String(e.forecast||'').trim()).length)],['KV binding',d.kvConfigured===false?'Missing':'Ready'],['Error',x.error||d.officialError||'None']]});
    }catch(e){setDcCard('dcNews',{status:'Error',tone:'bad',main:'Unavailable',sub:e.message,details:[['Error',e.message]]});}
    try{
      const x=by.etf,d=x.data||{};etfChecked=d.lastCheckedAt||d.updatedAt;etfTone=!x.ok?'bad':d.sourceStatus==='live'&&freshTone(etfChecked,36*60)==='live'?'live':freshTone(etfChecked,36*60);setDcCard('dcEtf',{status:toneLabel(etfTone,'Live','Stale','Offline'),tone:etfTone,main:Number.isFinite(Number(d.latestHoldings))?`${Number(d.latestHoldings).toFixed(2)} t`:'—',sub:`Official date: ${d.officialDate||'—'} · Change: ${Number(d.dailyChange||0).toFixed(2)} t`,details:[['Engine',d.engineVersion||'—'],['Source',d.source||'SPDR'],['Official date',d.officialDate||'—'],['Last checked',fmt(etfChecked)],['Last successful update',fmt(d.lastSuccessfulUpdateAt||d.updatedAt)],['KV write',d.kvWrite===true?'Yes':'No'],['Error',x.error||(d.errors||[]).join(' | ')||'None']]});
    }catch(e){setDcCard('dcEtf',{status:'Error',tone:'bad',main:'Unavailable',sub:e.message,details:[['Error',e.message]]});}
    try{
      const x=by.gold,d=x.data||{};goldChecked=d.lastCheckedAt||d.checkedAt||d.updatedAt;goldTone=!x.ok?'bad':d.sourceStatus==='live'&&freshTone(goldChecked,50*24*60)==='live'?'live':freshTone(goldChecked,50*24*60);setDcCard('dcGold',{status:toneLabel(goldTone,'Live','Stale','Offline'),tone:goldTone,main:`${(d.records||[]).length} countries`,sub:`${d.summary?.signal||'No signal'} · ${Number(d.summary?.netMonthlyChangeTonnes||0).toFixed(2)} t`,details:[['Engine',d.engineVersion||'—'],['Source mode',d.sourceMode||'—'],['Last checked',fmt(goldChecked)],['Last successful update',fmt(d.lastSuccessfulUpdateAt||d.updatedAt)],['Countries',String((d.records||[]).length)],['Warnings',(d.errors||[]).join(' | ')||x.error||'None']]});
    }catch(e){setDcCard('dcGold',{status:'Error',tone:'bad',main:'Unavailable',sub:e.message,details:[['Error',e.message]]});}
    try{
      const x=by.fed,d=x.data||{};fedChecked=d.cmeLastCheckedAt||d.lastCheckedAt||d.updatedAt;const manual=d.sourceMode==='manual-admin-primary';const official=d.sourceMode==='official-github-sync'&&d.live===true;fedTone=!x.ok?'bad':official?'live':manual?'warn':'warn';const top=(d.outcomes||[]).slice().sort((a,b)=>Number(b.probability)-Number(a.probability))[0];setDcCard('dcFed',{status:official?'CME Live':manual?'Admin Primary':x.ok?'Fallback':'Offline',tone:fedTone,main:top?`${Number(top.probability).toFixed(1)}%`:'—',sub:top?`${top.targetRange} · ${top.move||top.direction||''}`:'No probability data',details:[['Engine',d.engineVersion||'—'],['Effective source',d.sourceMode||'—'],['Current target',d.currentTargetRange||'—'],['Last CME check',fmt(fedChecked)],['Official fetch',d.officialFetchSucceeded===true?'Succeeded':'Unavailable'],['Manual override',d.manualOverrideAvailable?'Available':'Not saved'],['Last CME error',d.cmeLastError||d.lastOfficialFetchError||x.error||'None']]});
    }catch(e){setDcCard('dcFed',{status:'Error',tone:'bad',main:'Unavailable',sub:e.message,details:[['Error',e.message]]});}
    const tones=[newsTone,etfTone,goldTone,fedTone],points=tones.map(t=>t==='live'?100:t==='warn'?75:0),health=Math.round(points.reduce((a,b)=>a+b,0)/points.length);const checks=[newsChecked,etfChecked,goldChecked,fedChecked].filter(Boolean).map(Date.parse).filter(Number.isFinite),lastFull=checks.length?new Date(Math.min(...checks)).toISOString():null;
    safe('dcOverallHealth',`${health}%`);const bar=document.getElementById('dcOverallBar');if(bar)bar.style.width=`${health}%`;safe('dcLastFullCheck',lastFull?mytClock(lastFull):'No record');safe('dcLastFullCheckAge',lastFull?agoText(lastFull):'No record');const badge=document.getElementById('overallBadge');if(badge){badge.textContent=health>=90?'HEALTHY':health>=65?'ATTENTION':'ACTION NEEDED';badge.className=`badge ${health>=90?'ok':'warn'}`;}
    safe('dcCloudflare',fetched.every(x=>x.ok)?'● Online':fetched.some(x=>x.ok)?'▲ Partial':'● Offline');const news=by.news.data||{};safe('dcKv',news.kvConfigured===false?'▲ Missing':'● Bound');safe('dcForecast',news.kvConfigured===false?'▲ Unavailable':'● Ready');const fed=by.fed.data||{};safe('dcSourceMode',fed.sourceMode==='official-github-sync'?'CME Official':fed.sourceMode==='manual-admin-fallback'?'Fed Manual':'Mixed / Cached');safe('dcNewsFreshness',newsChecked?agoText(newsChecked):'No data');safe('dcEtfFreshness',etfChecked?agoText(etfChecked):'No data');safe('dcFedFreshness',fedChecked?agoText(fedChecked):'No data');safe('dcGoldFreshness',goldChecked?agoText(goldChecked):'No data');safe('dcStatusLine',`Last dashboard check: ${fmt(nowIso)} · Read-only health check; no extra KV writes.`);
    const healthList=document.getElementById('dataHealthCards');if(healthList)healthList.innerHTML=fetched.map(x=>{const d=x.data||{},checked=d.lastCheckedAt||d.checkedAt||d.updatedAt;return `<div class="mini-row"><span>${x.ok?'●':'▲'} ${esc(x.name)}<small style="display:block;opacity:.65">Checked: ${checked?fmt(checked):'No timestamp'}</small><small style="display:block;opacity:.55">Engine: ${esc(d.engineVersion||'—')}</small></span><b style="color:${x.ok?'#83d79f':'#ef7777'}">${x.ok?'Available':'Offline'}</b></div>`}).join('');
  }

  const auditCard=(name,status,message)=>`<div class="audit-item"><div class="audit-item-top"><strong>${esc(name)}</strong><span class="audit-pill ${status.toLowerCase()}">${status}</span></div><span class="audit-message">${esc(message)}</span></div>`;
  async function runSystemAudit(){
    const btn=$('#runAudit'),summary=$('#auditSummary'),box=$('#auditResults');btn.disabled=true;summary.textContent='Audit 进行中…';box.innerHTML='';
    const checks=[];
    const get=async(name,url,headers={})=>{try{const r=await fetch(`${url}${url.includes('?')?'&':'?'}audit=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache',...headers}});let d={};try{d=await r.json();}catch{}return {name,ok:r.ok,data:d,error:r.ok?'':(d.error||`HTTP ${r.status}`)};}catch(e){return {name,ok:false,data:{},error:e.message};}};
    try{
      const [news,etf,fed,gold,analytics]=await Promise.all([
        get('Economic News','/api/market-events'),get('ETF Holdings','/api/etf-engine'),get('Fed Rate','/api/rate-expectation-engine'),get('Central Bank Gold','/api/gold-reserves-engine'),get('Analytics','/api/analytics-dashboard',{'x-admin-pin':pin})
      ]);
      if(!news.ok)checks.push(['Economic News','FAIL',news.error]);else{const d=news.data||{},hist=(d.events||[]).filter(e=>Array.isArray(e.history)&&e.history.length).length,ver=String(d.engineVersion||'');checks.push(['Economic News',ver.startsWith('stable-data-')?'PASS':'WARNING',`${(d.events||[]).length} events · history ${hist}/${(d.events||[]).length} · ${ver||'unknown engine'}`]);checks.push(['Forecast / KV',d.kvConfigured===false?'FAIL':'PASS',d.kvConfigured===false?'KV binding missing':'Forecast storage binding ready; audit did not write data']);}
      if(!etf.ok)checks.push(['ETF Holdings','FAIL',etf.error]);else{const d=etf.data||{},good=String(d.engineVersion||'').startsWith('etf-stable')&&d.kvWrite!==true&&d.officialDate;checks.push(['ETF Holdings',good?'PASS':'WARNING',`${d.latestHoldings??'—'} t · official ${d.officialDate||'unknown'} · ${d.sourceStatus||d.status||'unknown'}`]);}
      if(!gold.ok)checks.push(['Central Bank Gold','FAIL',gold.error]);else{const d=gold.data||{},good=String(d.engineVersion||'').startsWith('gold-reserves')&&d.kvWrite!==true&&(d.records||[]).length>0;checks.push(['Central Bank Gold',good?'PASS':'WARNING',`${(d.records||[]).length} countries · ${d.sourceMode||'unknown source'} · ${d.sourceStatus||d.status||'unknown'}`]);}
      if(!fed.ok)checks.push(['Fed Rate','FAIL',fed.error]);else{const d=fed.data||{},total=(d.outcomes||[]).reduce((s,x)=>s+Number(x.probability||0),0),mode=d.sourceMode||'unknown',valid=Math.abs(total-100)<=1&&(d.outcomes||[]).length>=2;const official=mode==='official-github-sync'&&d.live===true,status=!valid?'FAIL':official?'PASS':mode==='manual-admin-primary'?'PASS':'WARNING';checks.push(['Fed Rate',status,`${mode} · probability total ${total.toFixed(1)}%${official?' · CME live':' · fallback/manual active'}`]);}
      if(!analytics.ok)checks.push(['Analytics','FAIL',analytics.error]);else if(!analytics.data?.configured)checks.push(['Analytics','WARNING','GA4 Data API variables are not configured']);else if(analytics.data?.error)checks.push(['Analytics','WARNING',analytics.data.error]);else checks.push(['Analytics','PASS',`${analytics.data.overview?.today?.activeUsers||0} visitors today · ${analytics.data.whatsapp?.today||0} WhatsApp clicks`]);
      const pass=checks.filter(x=>x[1]==='PASS').length,warn=checks.filter(x=>x[1]==='WARNING').length,fail=checks.filter(x=>x[1]==='FAIL').length;box.innerHTML=checks.map(x=>auditCard(...x)).join('');summary.textContent=`Audit completed: ${pass} PASS · ${warn} WARNING · ${fail} FAIL · ${mytClock(new Date().toISOString())}`;
    }catch(e){summary.textContent=`Audit failed: ${e.message}`;}finally{btn.disabled=false;}
  }


  async function checkNewsRecoveryStatus(){
    const r=await fetch(`/api/news-recovery?status=${Date.now()}`,{headers:{'x-admin-pin':pin,'cache-control':'no-cache'},cache:'no-store'});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'无法读取新闻发布修复状态');
    return d;
  }
  async function runNewsRecovery(){
    const btn=document.getElementById('repairMissingActual'),st=document.getElementById('newsRecoveryStatus');
    if(!btn||!st)return;
    const old=btn.textContent;btn.disabled=true;btn.textContent='检查中…';st.textContent='正在检查最近已发布但缺少 Actual 的新闻…';
    try{
      const before=await checkNewsRecoveryStatus();
      if(before.ready){st.textContent='发布链路完整：最近已发布新闻全部已有 Actual。';await load();return;}
      st.textContent=`发现 ${before.missing.length} 条缺少 Actual，正在启动 GitHub 自动修复…`;
      const r=await fetch(`/api/news-recovery?repair=${Date.now()}`,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'cache-control':'no-cache'},body:JSON.stringify({action:'repair'})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||d.message||'无法启动 GitHub 自动修复');
      st.textContent=`自动修复已启动：${(d.missing||[]).map(x=>x.name).join('、')}。Admin 将自动检查结果。`;
      for(let attempt=1;attempt<=18;attempt++){
        await new Promise(resolve=>setTimeout(resolve,20000));
        const status=await checkNewsRecoveryStatus();
        if(status.ready){st.textContent='修复成功：网站 API 已显示全部应发布的 Actual。';await load();return;}
        st.textContent=`自动修复进行中（${attempt}/18）：仍等待 ${(status.missing||[]).map(x=>x.name).join('、')}`;
      }
      st.textContent='自动修复仍在后台运行；系统会继续每5分钟验证。稍后刷新 Admin 查看结果。';
    }catch(e){st.textContent=`自动修复未启动：${e.message}`;}finally{btn.disabled=false;btn.textContent=old;}
  }
  async function load(){const r=await fetch(`${API}?force=1&t=${Date.now()}`,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'无法打开后台');events=d.events||[];meta=d;nextSyncAt=Math.ceil(Date.now()/SYNC_INTERVAL_MS)*SYNC_INTERVAL_MS;render();}
  async function unlock(){pin=$('#adminPin').value.trim();$('#loginStatus').textContent='检查中…';try{await load();await Promise.allSettled([loadAnalytics(),loadDataHealth(),loadFedEditor()]);sessionStorage.setItem('ghAdminPin',pin);$('#loginPanel').hidden=true;$('#dashboard').hidden=false;$('#loginStatus').textContent='';}catch(e){$('#loginStatus').textContent=e.message;}}
  $('#unlockAdmin').addEventListener('click',unlock);$('#adminPin').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});$('#adminPin').value=sessionStorage.getItem('ghAdminPin')||'';
  $('#searchInput').addEventListener('input',render);$('#filterSelect').addEventListener('change',render);$('#refreshData').addEventListener('click',async()=>{collect();$('#saveStatus').textContent='重新读取中…';try{await load();$('#saveStatus').textContent='已读取最新数据。';}catch(e){$('#saveStatus').textContent=e.message;}});
  const checkAll=document.getElementById('checkAllConnections');if(checkAll)checkAll.addEventListener('click',async()=>{checkAll.disabled=true;const old=checkAll.textContent;checkAll.textContent='检测中…';$('#saveStatus').textContent='正在直接访问全部官方来源…';try{await load();const h=Array.isArray(meta.connectionHealth)?meta.connectionHealth:[];const bad=h.filter(x=>x.status!=='live');$('#saveStatus').textContent=bad.length?`检测完成：${h.length-bad.length}/${h.length} 正常，${bad.length} 项正在自动重试/使用缓存。`:`检测完成：${h.length}/${h.length} 全部连接正常。`;}catch(e){$('#saveStatus').textContent=`检测失败：${e.message}`;}finally{checkAll.disabled=false;checkAll.textContent=old;}});
  $('#saveEvents').addEventListener('click',async()=>{collect();const st=$('#saveStatus'),btn=$('#saveEvents');st.textContent='保存 Forecast 中…';btn.disabled=true;try{
    const saveRes=await fetch(`${API}?save=${Date.now()}`,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'cache-control':'no-cache','pragma':'no-cache'},body:JSON.stringify({events:events.map(e=>({id:e.id,type:e.type,releasePeriod:e.releasePeriod,name:e.name,forecast:e.forecast,datetime:e.datetime,releaseForecasts:e.releaseForecasts||{}}))})});
    const saveData=await saveRes.json();
    if(!saveRes.ok)throw new Error(saveData.error||'Forecast KV 保存失败');
    if(!String(saveData.version||'').startsWith('stable-data-'))throw new Error('Cloudflare 新闻 Function 版本不匹配；请确认最新部署已上线。');
    await new Promise(r=>setTimeout(r,1200));
    const publicRes=await fetch(`${API}?verify=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache','pragma':'no-cache'}}),publicData=await publicRes.json();
    if(!publicRes.ok)throw new Error(publicData.error||'网站数据验证失败');if(!String(publicData.engineVersion||'').startsWith('stable-data-'))throw new Error('网站新闻 API 版本不匹配；请确认 Cloudflare Production 已部署稳定版。');
    const publicMap=new Map((publicData.events||[]).map(e=>[`${String(e.type||'')}|${String(e.releasePeriod||'')}`,{forecast:String(e.forecast??'').trim(),datetime:String(e.datetime??'').trim()}]));
    const publicMismatch=events.find(e=>{const row=publicMap.get(`${String(e.type||'')}|${String(e.releasePeriod||'')}`);return !row||row.forecast!==String(e.forecast??'').trim()||row.datetime!==String(e.datetime??'').trim();});
    if(publicMismatch)throw new Error(`KV 已保存，但网站 API 尚未读到 ${publicMismatch.name}。请确认 Production 部署与 KV binding。`);
    st.textContent=`已保存并验证 ${events.length} 项 Forecast（Gold Hunter Stable）。`;
    try{localStorage.setItem('gh-market-events-updated',String(Date.now()));}catch{}await load();
  }catch(e){st.textContent=e.message;}finally{btn.disabled=false;}});

  const repairBtn=document.getElementById('repairMissingActual');if(repairBtn)repairBtn.addEventListener('click',runNewsRecovery);
  $('#runAudit').addEventListener('click',runSystemAudit);
  $('#saveFedManual').addEventListener('click',saveFedManual);$('#reloadFedManual').addEventListener('click',loadFedEditor);
  $('#logoutAdmin').addEventListener('click',()=>{sessionStorage.removeItem('ghAdminPin');location.reload();});
  setInterval(tickSyncMonitor,1000);setInterval(()=>{if(pin){loadAnalytics();loadDataHealth();}},5*60*1000);
})();
