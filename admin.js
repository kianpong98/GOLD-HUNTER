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
    const apis=[['News','/api/market-events'],['ETF','/api/etf-engine'],['Fed Rate','/api/rate-expectation-engine'],['Central Bank Gold','/api/gold-reserves-engine']];
    const rows=await Promise.all(apis.map(async([name,url])=>{try{const r=await fetch(`${url}?health=${Date.now()}`,{cache:'no-store'}),d=await r.json();const live=d.live!==false&&d.sourceStatus!=='fallback';const checked=d.lastCheckedAt||d.updatedAt||d.generatedAt||null;const changed=d.lastDataChangeAt||d.sourceUpdatedAt||d.officialUpdatedAt||d.updatedAt||null;return {name,ok:r.ok,live,checked,changed,status:!r.ok?'Warning':live?'Healthy · Live':'Cached fallback',note:d.cacheMode||d.source||''}}catch{return {name,ok:false,live:false,checked:null,changed:null,status:'Offline',note:''}}}));
    $('#dataHealthCards').innerHTML=rows.map(x=>`<div class="mini-row"><span>${x.ok&&x.live?'●':'▲'} ${x.name}<small style="display:block;opacity:.65">Checked: ${x.checked?fmt(x.checked):'No timestamp'}</small><small style="display:block;opacity:.55">Data: ${x.changed?fmt(x.changed):'No timestamp'}</small>${x.note?`<small style="display:block;opacity:.5">${esc(x.note)}</small>`:''}</span><b style="color:${x.ok&&x.live?'#83d79f':'#efaa69'}">${x.status}</b></div>`).join('');
  }
  async function load(){const r=await fetch(API,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'无法打开后台');events=d.events||[];meta=d;nextSyncAt=Math.ceil(Date.now()/SYNC_INTERVAL_MS)*SYNC_INTERVAL_MS;render();}
  async function unlock(){pin=$('#adminPin').value.trim();$('#loginStatus').textContent='检查中…';try{await load();await Promise.allSettled([loadAnalytics(),loadDataHealth(),loadFedEditor()]);sessionStorage.setItem('ghAdminPin',pin);$('#loginPanel').hidden=true;$('#dashboard').hidden=false;$('#loginStatus').textContent='';}catch(e){$('#loginStatus').textContent=e.message;}}
  $('#unlockAdmin').addEventListener('click',unlock);$('#adminPin').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});$('#adminPin').value=sessionStorage.getItem('ghAdminPin')||'';
  $('#searchInput').addEventListener('input',render);$('#filterSelect').addEventListener('change',render);$('#refreshData').addEventListener('click',async()=>{collect();$('#saveStatus').textContent='重新读取中…';try{await load();$('#saveStatus').textContent='已读取最新数据。';}catch(e){$('#saveStatus').textContent=e.message;}});
  $('#saveEvents').addEventListener('click',async()=>{collect();const st=$('#saveStatus'),btn=$('#saveEvents');st.textContent='保存 Forecast 中…';btn.disabled=true;try{
    const saveRes=await fetch(`${API}?save=${Date.now()}`,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin,'cache-control':'no-cache','pragma':'no-cache'},body:JSON.stringify({events:events.map(e=>({id:e.id,type:e.type,releasePeriod:e.releasePeriod,name:e.name,forecast:e.forecast,datetime:e.datetime,releaseForecasts:e.releaseForecasts||{}}))})});
    const saveData=await saveRes.json();
    if(!saveRes.ok)throw new Error(saveData.error||'Forecast KV 保存失败');
    if(saveData.version!=='11-stable-data')throw new Error('Cloudflare 仍在运行旧版 Function；请确认最新部署已上线。');
    await new Promise(r=>setTimeout(r,1200));
    const publicRes=await fetch(`${API}?verify=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache','pragma':'no-cache'}}),publicData=await publicRes.json();
    if(!publicRes.ok)throw new Error(publicData.error||'网站数据验证失败');if(publicData.engineVersion!=='11-stable-data')throw new Error('网站 API 仍是旧版本；Cloudflare Production 尚未部署 Gold Hunter Stable。');
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
