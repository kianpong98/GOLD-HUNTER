(()=>{
  const API='/api/market-events'; const FED_API='/api/rate-expectation-engine'; const SYNC_INTERVAL_MS=5*60*1000; let pin='',events=[],meta={},nextSyncAt=0,autoRefreshBusy=false;
  const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusText=e=>e.eventOnly?'Event time only':e.actual?'Actual received':e.officialAuto?(e.previousStatus==='ready'?'Official connected':'Awaiting official sync'):'Manual / fallback';
  function visibleEvents(){const q=$('#searchInput').value.trim().toLowerCase(),f=$('#filterSelect').value,now=Date.now();return events.map((e,i)=>({e,i})).filter(({e})=>{
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
    const label={live:'● Live',cached:'● Cached',offline:'● Offline'};
    $('#sourceGrid').innerHTML=items.map(([n,v])=>`<div class="source ${v.status==='live'?'ok':'bad'}"><b>${label[v.status]||label.offline}</b>${n}<small style="display:block;opacity:.72;margin-top:5px">Last checked: ${fmt(v.lastChecked||meta.lastCheckedAt||meta.updatedAt)}</small><small style="display:block;opacity:.72;margin-top:3px">Last data change: ${fmt(v.lastSuccess)}</small></div>`).join('');
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
  function fedRowsFrom(data){const manual=data?.admin?.manualOverride;const effective=(manual&&data?.sourceMode!=='official-github-sync')?manual:data;return Array.isArray(effective?.outcomes)?effective.outcomes:[];}
  async function loadFedEditor(){
    const st=$('#fedManualStatus');
    try{
      const r=await fetch(`${FED_API}?admin=${Date.now()}`,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Fed Rate data unavailable');
      const manual=d.admin?.manualOverride||null, base=manual||d, rows=fedRowsFrom(d);
      setValue('fedMeetingDate',base.meetingDate||d.meetingDate||'');setValue('fedCurrentRange',base.currentTargetRange||d.currentTargetRange||'');
      setValue('fedRange1',rows[0]?.targetRange||'');setValue('fedProb1',rows[0]?.probability??'');setValue('fedRange2',rows[1]?.targetRange||'');setValue('fedProb2',rows[1]?.probability??'');
      setValue('fedEffectiveSource',d.sourceMode==='official-github-sync'?'CME Official (automatic primary)':d.sourceMode==='manual-admin-fallback'?'Admin Manual (CME unavailable)':'Verified static fallback');
      setValue('fedLastCmeCheck',fmt(d.cmeLastCheckedAt||d.lastCheckedAt||d.updatedAt));
      const badge=$('#fedEffectiveBadge');if(badge){badge.textContent=d.sourceMode==='official-github-sync'?'CME LIVE':d.sourceMode==='manual-admin-fallback'?'MANUAL ACTIVE':'STATIC FALLBACK';badge.className=`badge ${d.sourceMode==='official-github-sync'?'ok':'warn'}`;}
      st.textContent=d.sourceMode==='official-github-sync'?'CME 已连接，官网数据优先。你保存的手动值会保留，只有 CME 连接失败时才启用。':d.sourceMode==='manual-admin-fallback'?'CME 当前不可用，网站正在使用 Admin 手动概率。':'CME 当前不可用；尚未保存手动概率，网站使用最后验证快照。';
    }catch(e){st.textContent=e.message;}
  }
  async function saveFedManual(){
    const st=$('#fedManualStatus'),btn=$('#saveFedManual');btn.disabled=true;st.textContent='保存 Fed Rate 手动概率中…';
    const body={meetingDate:$('#fedMeetingDate').value,currentTargetRange:$('#fedCurrentRange').value,outcomes:[{targetRange:$('#fedRange1').value,probability:$('#fedProb1').value},{targetRange:$('#fedRange2').value,probability:$('#fedProb2').value}]};
    try{
      const r=await fetch(`${FED_API}?save=${Date.now()}`,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'cache-control':'no-cache'},body:JSON.stringify(body)}),d=await r.json();
      if(!r.ok)throw new Error(d.error+(d.detail?` · ${d.detail}`:''));
      st.textContent=d.unchanged?'内容没有变化，不需要重复写入 KV。':'已保存并验证。CME 连接失败时网站会自动使用这份手动概率。';
      await loadFedEditor();await loadDataHealth();
    }catch(e){st.textContent=e.message;}finally{btn.disabled=false;}
  }

  async function loadAnalytics(){
    const st=$('#analyticsStatus');
    try{
      const r=await fetch(`/api/analytics-dashboard?t=${Date.now()}`,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Analytics unavailable');
      if(!d.configured){st.textContent=d.message||'GA4 dashboard is not configured yet.';return;}
      const o=d.overview||{};$('#aVisitors').textContent=metric(o.activeUsers);$('#aWhatsapp').textContent=metric(o.whatsappClicks);$('#aSessions').textContent=metric(o.sessions);$('#aConversion').textContent=o.sessions?`${(o.whatsappClicks/o.sessions*100).toFixed(1)}%`:'0%';
      $('#aTopPages').innerHTML=listHtml(d.topPages);$('#aSources').innerHTML=listHtml(d.trafficSources);$('#aNews').innerHTML=listHtml(d.topNews);st.textContent=`Analytics updated: ${fmt(d.updatedAt)}`;
    }catch(e){st.textContent=e.message;}
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
      const x=by.fed,d=x.data||{};fedChecked=d.cmeLastCheckedAt||d.lastCheckedAt||d.updatedAt;const manual=d.sourceMode==='manual-admin-fallback';const official=d.sourceMode==='official-github-sync'&&d.live===true;fedTone=!x.ok?'bad':official?'live':manual?'warn':'warn';const top=(d.outcomes||[]).slice().sort((a,b)=>Number(b.probability)-Number(a.probability))[0];setDcCard('dcFed',{status:official?'CME Live':manual?'Manual Active':x.ok?'Fallback':'Offline',tone:fedTone,main:top?`${Number(top.probability).toFixed(1)}%`:'—',sub:top?`${top.targetRange} · ${top.move||top.direction||''}`:'No probability data',details:[['Engine',d.engineVersion||'—'],['Effective source',d.sourceMode||'—'],['Current target',d.currentTargetRange||'—'],['Last CME check',fmt(fedChecked)],['Official fetch',d.officialFetchSucceeded===true?'Succeeded':'Unavailable'],['Manual override',d.manualOverrideAvailable?'Available':'Not saved'],['Last CME error',d.cmeLastError||d.lastOfficialFetchError||x.error||'None']]});
    }catch(e){setDcCard('dcFed',{status:'Error',tone:'bad',main:'Unavailable',sub:e.message,details:[['Error',e.message]]});}
    const tones=[newsTone,etfTone,goldTone,fedTone],points=tones.map(t=>t==='live'?100:t==='warn'?75:0),health=Math.round(points.reduce((a,b)=>a+b,0)/points.length);const checks=[newsChecked,etfChecked,goldChecked,fedChecked].filter(Boolean).map(Date.parse).filter(Number.isFinite),lastFull=checks.length?new Date(Math.min(...checks)).toISOString():null;
    safe('dcOverallHealth',`${health}%`);const bar=document.getElementById('dcOverallBar');if(bar)bar.style.width=`${health}%`;safe('dcLastFullCheck',lastFull?mytClock(lastFull):'No record');safe('dcLastFullCheckAge',lastFull?agoText(lastFull):'No record');const badge=document.getElementById('overallBadge');if(badge){badge.textContent=health>=90?'HEALTHY':health>=65?'ATTENTION':'ACTION NEEDED';badge.className=`badge ${health>=90?'ok':'warn'}`;}
    safe('dcCloudflare',fetched.every(x=>x.ok)?'● Online':fetched.some(x=>x.ok)?'▲ Partial':'● Offline');const news=by.news.data||{};safe('dcKv',news.kvConfigured===false?'▲ Missing':'● Bound');safe('dcForecast',news.kvConfigured===false?'▲ Unavailable':'● Ready');const fed=by.fed.data||{};safe('dcSourceMode',fed.sourceMode==='official-github-sync'?'CME Official':fed.sourceMode==='manual-admin-fallback'?'Fed Manual':'Mixed / Cached');safe('dcNewsFreshness',newsChecked?agoText(newsChecked):'No data');safe('dcEtfFreshness',etfChecked?agoText(etfChecked):'No data');safe('dcFedFreshness',fedChecked?agoText(fedChecked):'No data');safe('dcGoldFreshness',goldChecked?agoText(goldChecked):'No data');safe('dcStatusLine',`Last dashboard check: ${fmt(nowIso)} · Read-only health check; no extra KV writes.`);
    const healthList=document.getElementById('dataHealthCards');if(healthList)healthList.innerHTML=fetched.map(x=>{const d=x.data||{},checked=d.lastCheckedAt||d.checkedAt||d.updatedAt;return `<div class="mini-row"><span>${x.ok?'●':'▲'} ${esc(x.name)}<small style="display:block;opacity:.65">Checked: ${checked?fmt(checked):'No timestamp'}</small><small style="display:block;opacity:.55">Engine: ${esc(d.engineVersion||'—')}</small></span><b style="color:${x.ok?'#83d79f':'#ef7777'}">${x.ok?'Available':'Offline'}</b></div>`}).join('');
  }

  async function load(){const r=await fetch(API,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'无法打开后台');events=d.events||[];meta=d;nextSyncAt=Math.ceil(Date.now()/SYNC_INTERVAL_MS)*SYNC_INTERVAL_MS;render();}
  async function unlock(){pin=$('#adminPin').value.trim();$('#loginStatus').textContent='检查中…';try{await load();await Promise.allSettled([loadAnalytics(),loadDataHealth(),loadFedEditor()]);sessionStorage.setItem('ghAdminPin',pin);$('#loginPanel').hidden=true;$('#dashboard').hidden=false;$('#loginStatus').textContent='';}catch(e){$('#loginStatus').textContent=e.message;}}
  $('#unlockAdmin').addEventListener('click',unlock);$('#adminPin').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});$('#adminPin').value=sessionStorage.getItem('ghAdminPin')||'';
  $('#searchInput').addEventListener('input',render);$('#filterSelect').addEventListener('change',render);$('#refreshData').addEventListener('click',async()=>{collect();$('#saveStatus').textContent='重新读取中…';try{await load();$('#saveStatus').textContent='已读取最新数据。';}catch(e){$('#saveStatus').textContent=e.message;}});
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

  $('#saveFedManual').addEventListener('click',saveFedManual);$('#reloadFedManual').addEventListener('click',loadFedEditor);
  $('#logoutAdmin').addEventListener('click',()=>{sessionStorage.removeItem('ghAdminPin');location.reload();});
  setInterval(tickSyncMonitor,1000);setInterval(()=>{if(pin){loadAnalytics();loadDataHealth();}},5*60*1000);
})();
