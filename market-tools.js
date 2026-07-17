(()=>{
  const EVENTS_API='/api/market-events';
  const SNAPSHOT_API='/api/market-snapshot';
  const ETF_DATA='/api/etf-engine';
  const GOLD_RESERVES_API='/api/gold-reserves-engine';
  const RATE_EXPECTATION_API='/api/rate-expectation-engine?v=11.0.4-fed-ui-sync';
  const sessions=[
    {name:'Sydney',short:'SYD',tz:'Australia/Sydney',open:8,close:17},
    {name:'Tokyo',short:'TKY',tz:'Asia/Tokyo',open:8,close:17},
    {name:'London',short:'LDN',tz:'Europe/London',open:8,close:17},
    {name:'New York',short:'NY',tz:'America/New_York',open:8,close:17}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(Math.max(0,n)).padStart(2,'0');
  const money=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const quoteState={
    gold:{price:null,change:null,updatedAt:null},
    dxy:{price:null,change:null,updatedAt:null}
  };
  try{
    const saved=JSON.parse(localStorage.getItem('ghQuoteState')||'{}');
    for(const k of ['gold','dxy']) if(saved[k]&&Number.isFinite(Number(saved[k].price))) quoteState[k]=saved[k];
  }catch{}

  function zonedParts(tz,date=new Date()){
    return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone:tz,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  }
  function sessionState(s){
    const p=zonedParts(s.tz),now=Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);
    const openSec=s.open*3600,closeSec=s.close*3600;
    const weekend=['Sat','Sun'].includes(p.weekday);
    const open=!weekend&&now>=openSec&&now<closeSec;
    let remaining;
    if(open) remaining=closeSec-now;
    else if(!weekend&&now<openSec) remaining=openSec-now;
    else {
      // Countdown to the next weekday open. This also handles Friday close and weekends.
      let days=1;
      const dayIndex=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday);
      let next=(dayIndex+1)%7;
      while(next===0||next===6){days++;next=(next+1)%7;}
      remaining=days*86400-now+openSec;
    }
    return {...s,open,status:open?'OPEN':'CLOSED',action:open?'Closes in':'Opens in',remaining,
      count:`${pad(Math.floor(remaining/3600))}:${pad(Math.floor((remaining%3600)/60))}:${pad(remaining%60)}`};
  }
  function renderSessions(){
    const states=sessions.map(sessionState).sort((a,b)=>Number(b.open)-Number(a.open)||a.remaining-b.remaining);
    const strip=document.getElementById('sessionStripItems');
    const grid=document.getElementById('marketSessionGrid');
    if(strip){
      strip.innerHTML=states.map(s=>`<span class="session-strip-item ${s.open?'open':'closed'}" title="${s.action} ${s.count}"><i></i><b>${s.short}</b><em>${s.open?'OPEN':'CLOSED'}</em><span>${s.count}</span></span>`).join('')+
      `<span class="session-strip-quote"><b>XAU</b><span id="stripGoldPrice">${money(quoteState.gold.price)}</span></span><span class="session-strip-quote"><b>DXY</b><span id="stripDxyPrice">${money(quoteState.dxy.price)}</span></span>`;
    }
    if(grid) grid.innerHTML=states.map(s=>`<article class="session-card ${s.open?'open':'closed'}"><div><h4>${s.name}</h4><span>${s.status}</span></div><p><b>${s.action}</b> ${s.count}</p></article>`).join('');
  }
  function fmt(iso){try{return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso))+' MYT';}catch{return'TBA';}}
  function historyFmt(value){if(!value)return'—';const d=new Date(value);if(!Number.isFinite(d.getTime()))return'—';try{return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' MYT';}catch{return'—';}}
  function countdown(iso){const ms=new Date(iso).getTime()-Date.now();if(!Number.isFinite(ms))return'TBA';if(ms<=0)return'Released';const total=Math.floor(ms/1000),d=Math.floor(total/86400),h=Math.floor((total%86400)/3600),m=Math.floor((total%3600)/60),sec=total%60;return d?`${d}D ${pad(h)}:${pad(m)}:${pad(sec)}`:`${pad(h)}:${pad(m)}:${pad(sec)}`;}
  function impactTone(e){
    const text=`${e.goldImpact||''} ${e.goldImpactZh||''}`.toLowerCase();
    if(/support|bullish|利多|positive/.test(text)) return 'bullish';
    if(/negative|bearish|pressure|利空/.test(text)) return 'bearish';
    return 'neutral';
  }
  function values(e){
    if(e.eventOnly){return `<div class="calendar-values event-only-values"><div><small>Status</small><b>${esc(e.status||'Scheduled')}</b></div><div><small>Release time</small><b>${esc(fmt(e.datetime))}</b></div></div>`;}
    const tone=impactTone(e);
    const insight=(e.comparison||e.goldImpact)?`<div class="release-insight ${tone}"><span class="comparison">${esc(e.comparison||'')}${e.comparisonZh?` · ${esc(e.comparisonZh)}`:''}</span>${e.difference?`<b>${esc(e.difference)}</b>`:''}${e.goldImpact?`<span class="gold-impact-label">${esc(e.goldImpact)}</span><small>${esc(e.goldImpactZh||'')}</small>`:''}${e.surpriseStrength?`<em>${esc(e.surpriseStrength)}${e.surpriseStrengthZh?` · ${esc(e.surpriseStrengthZh)}`:''}</em>`:''}</div>`:'';
    return `<div class="calendar-values"><div><small>Actual</small><b>${esc(e.actual||'—')}</b></div><div><small>Forecast</small><b>${esc(e.forecast||'—')}</b></div><div><small>Previous</small><b>${esc(e.previous||'—')}</b></div>${insight}</div>`;
  }
  function historyTable(e){if(e.eventOnly)return'';const rows=Array.isArray(e.history)?e.history.slice(0,10):[];if(!rows.length)return'';return `<details class="release-history"><summary>Last Release (${rows.length})</summary><div class="history-scroll"><table><thead><tr><th>Release date</th><th>Actual</th><th>Forecast</th><th>Previous</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(historyFmt(r.dateTime||r.releaseDateTime||''))}</td><td>${esc(r.actual||'—')}</td><td>${esc(r.forecast||'—')}</td><td>${esc(r.previous||'—')}</td></tr>`).join('')}</tbody></table></div></details>`;}
  function card(e,full=false){
    const source=e.sourceUrl?`<a class="event-source" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(e.sourceName||'Official source')} ↗</a>`:'';
    const tone=impactTone(e);
    const released=countdown(e.datetime)==='Released';
    if(!full){
      return `<article class="market-event-row ${tone}" data-news-type="${esc(e.type||e.id||'economic_event')}" data-event-type="${esc(e.type||e.id||'economic_event')}" data-event-name="${esc(e.name||'Economic event')}" data-analytics-section="economic_news"><div class="market-event-main"><div><h3>${esc(e.name)}</h3><p class="event-zh">${esc(e.nameZh||'')}</p><p>${esc(fmt(e.datetime))}</p><strong class="event-countdown" data-date="${esc(e.datetime)}">${esc(countdown(e.datetime))}</strong></div></div>${values(e)}</article>`;
    }
    const statusClass=released?'released':'upcoming';
    const statusText=released?'Released':countdown(e.datetime);
    const insight=(e.comparison||e.goldImpact||released)?`<section class="calendar-impact-panel ${tone}"><div class="calendar-impact-head"><span class="impact-arrow">${tone==='bullish'?'↓':tone==='bearish'?'↑':'◷'}</span><strong>${esc(e.comparison||(!released?'Upcoming':'Released'))}${e.comparisonZh?` <i>${esc(e.comparisonZh)}</i>`:''}</strong></div>${e.difference?`<b class="impact-difference">${esc(e.difference)}</b>`:''}${e.goldImpact?`<span class="impact-pill">${esc(e.goldImpactZh||e.goldImpact)}</span><p>${esc(e.goldImpact)}</p>`:`<p>${released?'Official result released.':'Waiting for official release.'}</p>`}${e.surpriseStrength?`<em>${esc(e.surpriseStrength)}${e.surpriseStrengthZh?` · ${esc(e.surpriseStrengthZh)}`:''}</em>`:''}</section>`:'';
    return `<article class="calendar-item calendar-item-v2 ${tone}" data-news-type="${esc(e.type||e.id||'economic_event')}" data-event-type="${esc(e.type||e.id||'economic_event')}" data-event-name="${esc(e.name||'Economic event')}" data-analytics-section="economic_news"><section class="calendar-event-info"><div class="calendar-title-row"><h3>${esc(e.name)}</h3></div><p class="event-zh">${esc(e.nameZh||'')}</p><div class="calendar-meta"><span>▣ ${esc(fmt(e.datetime))}</span><strong class="event-countdown ${statusClass}" data-date="${esc(e.datetime)}">${esc(statusText)}</strong></div><div class="calendar-links">${source}${historyTable(e)}</div></section><section class="calendar-metrics"><div><small>Actual</small><b class="actual-value">${esc(e.actual||'—')}</b></div><div><small>Forecast</small><b>${esc(e.forecast||'—')}</b></div><div><small>Previous</small><b>${esc(e.previous||'—')}</b></div></section>${insight}</article>`;
  }
  function updateCountdowns(){document.querySelectorAll('.event-countdown[data-date]').forEach(el=>el.textContent=countdown(el.dataset.date));}
  async function loadEvents(){
    const home=document.getElementById('homeMarketEvents'),full=document.getElementById('calendarList');
    if(!home&&!full)return;
    try{
      const eventUrl=`${EVENTS_API}?v=${Date.now()}`;
      const r=await fetch(eventUrl,{cache:'no-store',headers:{'cache-control':'no-cache','pragma':'no-cache'}}),d=await r.json();
      if(!r.ok)throw new Error(d.error||'Calendar unavailable');
      const raw=(d.events||[]).filter(e=>e.showOnCalendar!==false&&Number(e.impact)>=4&&!/ism/i.test(String(e.type||''))&&!/ISM/i.test(String(e.name||'')));
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const day=e=>String(e.datetime||'').slice(0,10);
      const ms=e=>new Date(e.datetime).getTime();
      const ordered=[...raw].sort((a,b)=>{
        // Verified releases from the previous two days are pinned to the top of
        // the full Calendar only. Within that group, the latest release is first.
        const ap=Boolean(a.calendarPinned||a.lifecycleStage==='recent_release');
        const bp=Boolean(b.calendarPinned||b.lifecycleStage==='recent_release');
        if(ap!==bp)return ap?-1:1;
        const at=ms(a),bt=ms(b);
        if(ap&&bp)return bt-at;
        const ag=day(a)===today?0:(at>=Date.now()?1:2);
        const bg=day(b)===today?0:(bt>=Date.now()?1:2);
        if(ag!==bg)return ag-bg;
        return ag===2?bt-at:at-bt;
      });
      const homeEvents=ordered.filter(e=>e.showOnHome!==false&&!e.calendarPinned&&(day(e)===today||ms(e)>=Date.now())).slice(0,3);
      if(home)home.innerHTML=homeEvents.map(e=>card(e,false)).join('')||'<div class="market-empty">No upcoming events.</div>';
      if(full)full.innerHTML=ordered.map(e=>card(e,true)).join('')||'<div class="market-empty">No events.</div>';
      const stamp=document.getElementById('calendarUpdated');
      if(stamp)stamp.textContent=`Last updated: ${new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'medium'}).format(new Date(d.updatedAt))} MYT`;
      updateCountdowns();
    }catch(e){const msg=`<div class="market-empty"><b>Calendar unavailable.</b><span>${esc(e.message)}</span></div>`;if(home)home.innerHTML=msg;if(full)full.innerHTML=msg;}
  }

  function setQuote(id,value,change,updatedAt){
    const valid=Number.isFinite(Number(value));
    if(valid){
      quoteState[id]={price:Number(value),change:Number.isFinite(Number(change))?Number(change):quoteState[id]?.change??null,updatedAt:updatedAt||new Date().toISOString()};
      try{localStorage.setItem('ghQuoteState',JSON.stringify(quoteState));}catch{}
    }
    const current=quoteState[id]||{};
    const price=document.getElementById(id+'Price'),chg=document.getElementById(id+'Change'),strip=document.getElementById(id==='gold'?'stripGoldPrice':'stripDxyPrice');
    if(price&&Number.isFinite(Number(current.price)))price.textContent=money(current.price);
    if(strip&&Number.isFinite(Number(current.price)))strip.textContent=money(current.price);
    if(chg){const n=Number(current.change);chg.className=Number.isFinite(n)?(n>0?'up':n<0?'down':'flat'):'';chg.textContent=Number.isFinite(n)?`${n>0?'▲ +':n<0?'▼ ':'• '}${n.toFixed(2)}%`:'Last known price';}
  }
  async function loadSnapshot(){
    if(!document.getElementById('goldPrice')&&!document.getElementById('dxyPrice')&&!document.getElementById('stripGoldPrice')&&!document.getElementById('stripDxyPrice'))return;
    try{const r=await fetch(SNAPSHOT_API,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Quote unavailable');setQuote('gold',d.gold?.price,d.gold?.changePct,d.gold?.timestamp||d.updatedAt);setQuote('dxy',d.dxy?.price,d.dxy?.changePct,d.dxy?.timestamp||d.updatedAt);const u=document.getElementById('marketSnapshotUpdated');if(u)u.textContent=d.updatedAt?`Updated ${new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(d.updatedAt))}`:'Delayed';}catch(e){setQuote('gold',null,null);setQuote('dxy',null,null);const u=document.getElementById('marketSnapshotUpdated');if(u)u.textContent='Using last known price';}}

  function drawEtfChart(records){const box=document.getElementById('etfChart');if(!box)return;if(records.length<2){box.innerHTML='<div class="market-empty compact">ETF history will appear after the daily sync.</div>';return;}const vals=records.map(x=>Number(x.holdings)).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const w=600,h=92,padX=8,padY=10;const pts=records.map((r,i)=>`${padX+i*(w-padX*2)/(records.length-1)},${padY+(max-Number(r.holdings))*(h-padY*2)/range}`).join(' ');box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"><defs><linearGradient id="etfFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b64b" stop-opacity=".32"/><stop offset="1" stop-color="#d8b64b" stop-opacity="0"/></linearGradient></defs><polygon points="${padX},${h-padY} ${pts} ${w-padX},${h-padY}" fill="url(#etfFill)"/><polyline points="${pts}" fill="none" stroke="#d8b64b" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;}
  async function loadEtf(){const summary=document.getElementById('etfSummary'),history=document.getElementById('etfHistory');if(!summary&&!history)return;try{const r=await fetch(ETF_DATA,{cache:'no-store'}),d=await r.json();const records=(d.records||[]).slice(0,30).sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(!records.length)throw new Error('Awaiting official SPDR daily sync');const latest=records.at(-1),prior=records.at(-2),change=prior?Number(latest.holdings)-Number(prior.holdings):Number(latest.change||0);summary.innerHTML=`<div><span>Current holdings</span><strong>${Number(latest.holdings).toFixed(2)} t</strong></div><div class="etf-daily ${change>0?'up':change<0?'down':'flat'}"><b>${change>0?'▲':change<0?'▼':'•'} ${change>0?'+':''}${change.toFixed(2)} t</b><span>${change>0?'Net inflow':change<0?'Net outflow':'Unchanged'}</span></div><small>Official date ${esc(d.officialDate||latest.date)} · Last updated ${esc((d.lastSuccessfulConnectionAt||d.lastSuccessfulUpdateAt||d.checkedAt)?new Date(d.lastSuccessfulConnectionAt||d.lastSuccessfulUpdateAt||d.checkedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}):'pending')} MYT</small>`;drawEtfChart(records);if(history)history.innerHTML=`<div class="history-scroll"><table><thead><tr><th>Date</th><th>Holdings</th><th>Daily change</th></tr></thead><tbody>${[...records].reverse().map((x,i,a)=>{const next=a[i+1],c=next?Number(x.holdings)-Number(next.holdings):Number(x.change||0);return `<tr><td>${esc(x.date)}</td><td>${Number(x.holdings).toFixed(2)} t</td><td>${(()=>{const n=Number(c);return `<span class=\"etf-change ${n>0?'up':n<0?'down':'flat'}\">${n>0?'▲':n<0?'▼':'•'} ${n>0?'+':''}${n.toFixed(2)} t</span>`})()}</td></tr>`}).join('')}</tbody></table></div>`;}catch(e){if(summary)summary.innerHTML=`<div class="market-empty compact">${esc(e.message)}</div>`;drawEtfChart([]);}}
  function setupEtfToggle(){const b=document.getElementById('toggleEtfHistory'),h=document.getElementById('etfHistory');if(!b||!h)return;b.addEventListener('click',()=>{h.hidden=!h.hidden;b.textContent=h.hidden?'View 30 Days →':'Hide 30 Days ↑';});}

  async function loadGoldReserves(){
    const summary=document.getElementById('goldReservesSummary'),grid=document.getElementById('goldReservesGrid'),table=document.getElementById('goldReservesTable');
    if(!summary&&!grid&&!table)return;
    try{
      const r=await fetch(GOLD_RESERVES_API,{cache:'no-store'}),d=await r.json();
      const rows=Array.isArray(d.records)?d.records:[];
      if(!rows.length)throw new Error(d.message||'Awaiting first official monthly sync');
      const net=Number(d.summary?.netMonthlyChangeTonnes),hasNet=Number.isFinite(net);
      summary.innerHTML=`<div><span>Tracked official holders</span><strong>${rows.length}</strong></div><div class="reserve-signal ${hasNet?(net>0?'up':net<0?'down':'flat'):'flat'}"><b>${hasNet?(net>0?'▲ +':net<0?'▼ ':'• ')+net.toFixed(2)+' t':'Monthly data'}</b><span>${esc(d.summary?.signal||'Official holdings')}</span></div><small>Last updated ${esc((d.lastSuccessfulConnectionAt||d.lastSuccessfulUpdateAt||d.checkedAt)?new Date(d.lastSuccessfulConnectionAt||d.lastSuccessfulUpdateAt||d.checkedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}):'pending')} MYT · WGC / IMF IFS</small>`;
      const featured=rows.slice(0,6);
      if(grid)grid.innerHTML=featured.map(x=>`<article><span>${esc(x.country)}</span><strong>${Number(x.holdingsTonnes).toLocaleString('en-US',{maximumFractionDigits:2})} t</strong><em class="${Number(x.monthlyChangeTonnes)>0?'up':Number(x.monthlyChangeTonnes)<0?'down':'flat'}">${Number.isFinite(Number(x.monthlyChangeTonnes))?`${Number(x.monthlyChangeTonnes)>0?'+':''}${Number(x.monthlyChangeTonnes).toFixed(2)} t monthly`:'Monthly change pending'}</em></article>`).join('');
      if(table)table.innerHTML=`<div class="history-scroll"><table><thead><tr><th>Country</th><th>Holdings</th><th>Monthly change</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.country)}</td><td>${Number(x.holdingsTonnes).toLocaleString('en-US',{maximumFractionDigits:2})} t</td><td>${Number.isFinite(Number(x.monthlyChangeTonnes))?`${Number(x.monthlyChangeTonnes)>0?'+':''}${Number(x.monthlyChangeTonnes).toFixed(2)} t`:'—'}</td></tr>`).join('')}</tbody></table></div><a class="reserve-source" href="${esc(d.sourceUrl||'https://www.gold.org/goldhub/data/gold-reserves-by-country')}" target="_blank" rel="noopener">Official source: World Gold Council / IMF IFS ↗</a>`;
    }catch(e){
      if(summary)summary.innerHTML=`<div class="market-empty compact">${esc(e.message)}</div>`;
      if(grid)grid.innerHTML='';
    }
  }

  const formatProbability=value=>{const n=Number(value);if(!Number.isFinite(n))return '—';return Math.abs(n-Math.round(n))<0.05?n.toFixed(0):n.toFixed(1);};

  async function loadRateExpectation(){
    const box=document.getElementById('rateExpectationBody');
    if(!box)return;
    try{
      const fallbackData=null;
      async function readJson(url){
        try{
          const r=await fetch(url,{cache:'no-store'});
          if(!r.ok)return null;
          const type=(r.headers.get('content-type')||'').toLowerCase();
          if(!type.includes('json'))return null;
          const data=await r.json();
          return data&&typeof data==='object'?data:null;
        }catch(_){return null;}
      }
      // Always request the live engine first with a cache-busting query. The engine itself
      // uses a five-minute edge cache and never writes Workers KV.
      const apiData=await readJson(`${RATE_EXPECTATION_API}&_=${Date.now()}`);
      const validRateData=value=>{
        if(!value||!Array.isArray(value.outcomes)||!value.outcomes.length)return false;
        const rows=value.outcomes.map(x=>Number(x.probability)).filter(Number.isFinite);
        const total=rows.reduce((sum,n)=>sum+n,0);
        return rows.length===value.outcomes.length&&total>=98.5&&total<=101.5;
      };
      let d=validRateData(apiData)?apiData:null;
      if(d){
        try{localStorage.setItem('ghFedWatchLastVerified',JSON.stringify(d));}catch{}
      }
      if(!d){
        try{
          const saved=JSON.parse(localStorage.getItem('ghFedWatchLastVerified')||'null');
          if(validRateData(saved))d={...saved,live:false,sourceStatus:'browser-last-verified'};
        }catch{}
      }
      d=d
        ||(await readJson('./assets/data/rate-expectation.json?v=11.0.4-fed-ui-sync'))
        ||(await readJson('/assets/data/rate-expectation.json?v=11.0.4-fed-ui-sync'))
        ||fallbackData;
      if(!d)throw new Error('Rate expectations are awaiting a verified CME update');
      const outcomes=(Array.isArray(d.outcomes)?d.outcomes:[])
        .map(x=>({...x,probability:Number(x.probability)}))
        .filter(x=>x.targetRange&&Number.isFinite(x.probability))
        .sort((a,b)=>b.probability-a.probability);
      if(!outcomes.length)throw new Error('Rate probabilities are awaiting update');
      const leader=outcomes[0];
      const dir=leader.direction==='cut'?'cut':leader.direction==='hike'?'hike':'hold';
      const impact=dir==='cut'?'Supportive for gold':dir==='hike'?'Pressure for gold':'Neutral for gold';
      const impactText=dir==='cut'?'Lower-rate expectations usually reduce the opportunity cost of holding gold.':dir==='hike'?'Higher-rate expectations usually support yields and the U.S. dollar.':'Markets currently expect policy to remain unchanged.';
      const total=outcomes.reduce((n,x)=>n+x.probability,0);
      const meetingIso=d.meetingDateTime||d.meetingDate||'';
      const meetingInstant=meetingIso?new Date(meetingIso):null;
      const meetingValid=meetingInstant&&!Number.isNaN(meetingInstant.getTime());
      const meetingTz=d.meetingTimezone||'Asia/Kuala_Lumpur';
      const meetingDateText=meetingValid?new Intl.DateTimeFormat('en-MY',{timeZone:meetingTz,day:'2-digit',month:'short',year:'numeric'}).format(meetingInstant):'TBA';
      const meetingTimeText=meetingValid?new Intl.DateTimeFormat('en-MY',{timeZone:meetingTz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(meetingInstant):'—';
      box.innerHTML=`
        <div class="rate-hero">
          <div class="rate-meeting">
            <span>${esc(d.meetingLabel||'Next FOMC decision')}</span>
            <strong>${esc(meetingDateText)}</strong>
            <b class="rate-meeting-time">${esc(meetingTimeText)} <i>${esc(d.meetingTimezoneLabel||'Malaysia Time (MYT)')}</i></b>
            <div class="rate-countdown"><span>Decision countdown</span><strong data-rate-countdown="${esc(meetingValid?meetingInstant.toISOString():'')}">--d --:--:--</strong></div>
            <small>Current target range&nbsp; ${esc(d.currentTargetRange||'—')}</small>
          </div>
          <div class="rate-primary ${dir}">
            <span>Highest probability</span>
            <strong>${esc(leader.targetRange)}</strong>
            <b>${formatProbability(leader.probability)}%</b>
            <small>${esc(leader.move||'Market-implied outcome')}</small>
          </div>
        </div>
        <div class="rate-decision-summary">
          <div><span>Current Rate</span><strong>${esc(d.currentTargetRange||'—')}</strong></div>
          <div class="rate-arrow" aria-hidden="true">↓</div>
          <div><span>Expected</span><strong>${esc(leader.targetRange)}</strong></div>
          <div><span>Probability</span><strong>${formatProbability(leader.probability)}%</strong></div>
          <div><span>Expected Move</span><strong>${esc((()=>{const parseRange=v=>{const nums=String(v||'').match(/\d+(?:\.\d+)?/g)||[];return nums.length>=2?(Number(nums[0])+Number(nums[1]))/2:null};const current=parseRange(d.currentTargetRange),expected=parseRange(leader.targetRange);if(current===null||expected===null)return leader.move||'—';const bps=Math.round((expected-current)*100);return `${bps>0?'+':''}${bps} bps`;})())}</strong></div>
          <div class="${dir}"><span>Gold</span><strong>${dir==='cut'?'Bullish':dir==='hike'?'Bearish':'Neutral'}</strong></div>
        </div>
        <div class="rate-range-list">
          ${outcomes.map((x,i)=>{
            const k=x.direction==='cut'?'cut':x.direction==='hike'?'hike':'hold';
            return `<article class="rate-range-row ${k} ${i===0?'is-leading':''}">
              <div class="rate-range-copy">
                <span>${esc(x.move||'Target range')}</span>
                <strong>${esc(x.targetRange)}</strong>
              </div>
              <div class="rate-range-meter"><i><b style="width:${Math.max(0,Math.min(100,x.probability))}%"></b></i><small>${formatProbability(x.probability)}% probability</small></div>
              <em>${formatProbability(x.probability)}%</em>
            </article>`;
          }).join('')}
        </div>
        <div class="rate-insight ${dir}">
          <div><span>Gold impact</span><strong>${impact}</strong></div>
          <p>${impactText}</p>
        </div>
        <div class="rate-source-row">
          <small>${d.sourceMode==='manual-admin-primary'?'Admin controlled':d.sourceMode==='cloudflare-cron-calculated'?'Gold Hunter calculated':d.live?'Live CME':d.sourceStatus==='cached-last-good'?'Cached last verified CME':d.sourceStatus==='browser-last-verified'?'Browser last verified CME':'Verified fallback'} · Checked ${esc((d.lastCheckedAt||d.updatedAt)?new Date(d.lastCheckedAt||d.updatedAt).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'}):'pending')} · Total ${formatProbability(total)}% · No KV writes</small>
          <a href="${esc(d.sourceUrl||'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html')}" target="_blank" rel="noopener">View source ↗</a>
        </div>`;
      const countdownEl=box.querySelector('[data-rate-countdown]');
      if(countdownEl){
        const targetMs=new Date(countdownEl.dataset.rateCountdown).getTime();
        const tick=()=>{
          if(!Number.isFinite(targetMs)){countdownEl.textContent='Time pending';return;}
          let left=targetMs-Date.now();
          if(left<=0){countdownEl.textContent='Decision released';return;}
          const days=Math.floor(left/86400000);left%=86400000;
          const hours=Math.floor(left/3600000);left%=3600000;
          const minutes=Math.floor(left/60000);left%=60000;
          const seconds=Math.floor(left/1000);
          countdownEl.textContent=`${days}d ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        };
        tick();
        clearInterval(window.__ghRateCountdownTimer);
        window.__ghRateCountdownTimer=setInterval(tick,1000);
      }
    }catch(e){box.innerHTML=`<div class="market-empty compact">${esc(e.message)}</div>`;}
  }

  function setupReserveToggle(){const b=document.getElementById('toggleReserveTable'),h=document.getElementById('goldReservesTable');if(!b||!h)return;b.addEventListener('click',()=>{h.hidden=!h.hidden;b.textContent=h.hidden?'View Countries →':'Hide Countries ↑';});}

  renderSessions();
  loadEvents();
  loadSnapshot();
  loadEtf();
  setupEtfToggle();
  loadGoldReserves();
  setupReserveToggle();
  loadRateExpectation();
  setInterval(renderSessions,1000);
  setInterval(updateCountdowns,1000);
  setInterval(loadSnapshot,2500);
  setInterval(loadEvents,30000);
  window.addEventListener('storage',e=>{if(e.key==='gh-market-events-updated')loadEvents();});
  window.addEventListener('focus',loadEvents);
})();
