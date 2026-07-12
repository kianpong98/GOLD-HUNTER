(()=>{
  const API='/api/market-events'; const SYNC_INTERVAL_MS=5*60*1000; let pin='',events=[],meta={},nextSyncAt=0,autoRefreshBusy=false;
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
      const fields=eventOnly?`<label class="label">Malaysia date & time<input class="input" data-k="datetime" type="datetime-local" value="${esc((e.datetime||'').slice(0,16))}"></label><label class="label">Status<input class="input locked" readonly value="${esc(e.status||'Scheduled')}"></label>`:`<label class="label">Malaysia date & time<input class="input" data-k="datetime" type="datetime-local" value="${esc((e.datetime||'').slice(0,16))}"></label><label class="label">Next Forecast<input class="input" data-k="forecast" value="${esc(e.forecast)}" placeholder="下一次，例如 2.8% / 180K"></label><label class="label">Previous (Automatic)<input class="input locked" readonly value="${esc(e.previous||'—')}"></label><label class="label">Actual (Official)<input class="input locked" readonly value="${esc(e.actual||'—')}"></label><div class="history-wrap"><b>最近 10 次 Last Releases</b>${historyRows||'<p class="admin-note">官方历史记录同步后会显示在这里。</p>'}</div>`;
      return `<article class="event ${waiting?'waiting':'ready'}" data-i="${i}"><div class="event-head"><div><strong>${esc(e.name)}</strong><span class="zh">${esc(e.nameZh||'')} · ${esc(e.releasePeriod||'')}</span></div><div class="badges"><span class="badge">${'★'.repeat(Number(e.impact)||4)}</span><span class="badge ${waiting?'warn':'ok'}">${esc(statusText(e))}</span></div></div><div class="grid">${fields}</div></article>`;
    }).join(''):'<p class="admin-note">没有符合筛选条件的新闻。</p>';
    updateStats();
  }
  function updateStats(){const waiting=events.filter(e=>e.previousStatus==='awaiting_official'||(e.released&&!e.actual&&!e.eventOnly)).length;$('#totalCount').textContent=events.length;$('#readyCount').textContent=events.filter(e=>e.officialAuto&&e.previousStatus==='ready').length;$('#waitingCount').textContent=waiting;$('#forecastCount').textContent=events.filter(e=>e.forecast).length;
    const cs=meta.connectorSources||{};const legacy=meta.officialSources||{};
    const normalize=(key,fallback)=>cs[key]||{status:fallback?'live':'offline',lastSuccess:meta.officialUpdatedAt||null};
    const items=[['Static Cache',normalize('staticCache',legacy.staticCache)],['BLS',normalize('bls',legacy.bls)],['FRED',normalize('fred',legacy.fred)],['Department of Labor',normalize('dol',legacy.dol)],['BEA',normalize('bea',legacy.bea)],['Federal Reserve',normalize('federalReserve',legacy.federalReserve)],['Cloudflare KV',normalize('cloudflareKv',meta.kvConfigured)]];
    const label={live:'● Live',cached:'● Cached',offline:'● Offline'};
    $('#sourceGrid').innerHTML=items.map(([n,v])=>`<div class="source ${v.status==='live'?'ok':'bad'}"><b>${label[v.status]||label.offline}</b>${n}<small style="display:block;opacity:.72;margin-top:5px">Last success: ${fmt(v.lastSuccess)}</small></div>`).join('');
    $('#syncLine').textContent=`页面更新：${fmt(meta.updatedAt)} · 官方数据更新：${fmt(meta.officialUpdatedAt)}${meta.officialError?' · '+meta.officialError:''}`;updateSyncMonitor(items);}
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
    set('retrySourceCount',String(nonLive)); set('healthScore',`${health}%`); const bar=document.getElementById('healthBar');if(bar)bar.style.width=`${health}%`;
  }
  function tickSyncMonitor(){
    const now=Date.now(); if(nextSyncAt&&now>=nextSyncAt){nextSyncAt+=SYNC_INTERVAL_MS;if(pin&&!autoRefreshBusy){autoRefreshBusy=true;load().catch(()=>{}).finally(()=>autoRefreshBusy=false);}}
    const cs=meta.connectorSources||{},legacy=meta.officialSources||{};const normalize=(key,fallback)=>cs[key]||{status:fallback?'live':'offline',lastSuccess:meta.officialUpdatedAt||null};
    const items=[['Static Cache',normalize('staticCache',legacy.staticCache)],['BLS',normalize('bls',legacy.bls)],['FRED',normalize('fred',legacy.fred)],['Department of Labor',normalize('dol',legacy.dol)],['BEA',normalize('bea',legacy.bea)],['Federal Reserve',normalize('federalReserve',legacy.federalReserve)],['Cloudflare KV',normalize('cloudflareKv',meta.kvConfigured)]];updateSyncMonitor(items);
  }
  const fmt=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false}):'尚无记录';
  function collect(){document.querySelectorAll('.event').forEach(card=>{const i=+card.dataset.i;card.querySelectorAll('[data-k]').forEach(input=>{if(input.disabled)return;let v=input.value.trim();const key=input.dataset.k;if(key==='datetime'&&v&&!/[zZ]|[+-]\d\d:\d\d$/.test(v))v+=':00+08:00';events[i][key]=v;});events[i].releaseForecasts=events[i].releaseForecasts||{};card.querySelectorAll('[data-history-period]').forEach(input=>{const period=input.dataset.historyPeriod;const value=input.value.trim();if(period){if(value)events[i].releaseForecasts[period]=value;else delete events[i].releaseForecasts[period];}});});}
  async function load(){const r=await fetch(API,{headers:{'x-admin-pin':pin},cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'无法打开后台');events=d.events||[];meta=d;nextSyncAt=Math.ceil(Date.now()/SYNC_INTERVAL_MS)*SYNC_INTERVAL_MS;render();}
  async function unlock(){pin=$('#adminPin').value.trim();$('#loginStatus').textContent='检查中…';try{await load();sessionStorage.setItem('ghAdminPin',pin);$('#loginPanel').hidden=true;$('#dashboard').hidden=false;$('#loginStatus').textContent='';}catch(e){$('#loginStatus').textContent=e.message;}}
  $('#unlockAdmin').addEventListener('click',unlock);$('#adminPin').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});$('#adminPin').value=sessionStorage.getItem('ghAdminPin')||'';
  $('#searchInput').addEventListener('input',render);$('#filterSelect').addEventListener('change',render);$('#refreshData').addEventListener('click',async()=>{collect();$('#saveStatus').textContent='重新读取中…';try{await load();$('#saveStatus').textContent='已读取最新数据。';}catch(e){$('#saveStatus').textContent=e.message;}});
  $('#saveEvents').addEventListener('click',async()=>{collect();const st=$('#saveStatus'),btn=$('#saveEvents');st.textContent='保存中…';btn.disabled=true;try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','x-admin-pin':pin},body:JSON.stringify({events})}),d=await r.json();if(!r.ok)throw new Error(d.error||'保存失败');st.textContent=`已保存 ${d.count} 项。Forecast 已写入实时数据，网站会立即重新读取。`;try{localStorage.setItem('gh-market-events-updated',String(Date.now()));}catch{}await load();}catch(e){st.textContent=e.message;}finally{btn.disabled=false;}});
  $('#logoutAdmin').addEventListener('click',()=>{sessionStorage.removeItem('ghAdminPin');location.reload();});
  setInterval(tickSyncMonitor,1000);
})();
