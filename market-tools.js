(()=>{
  const EVENTS_API='/api/market-events';
  const SNAPSHOT_API='/api/market-snapshot';
  const ETF_DATA='/assets/data/spdr-gld-holdings.json';
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
  function countdown(iso){const ms=new Date(iso).getTime()-Date.now();if(!Number.isFinite(ms))return'TBA';if(ms<=0)return'Released';const total=Math.floor(ms/1000),d=Math.floor(total/86400),h=Math.floor((total%86400)/3600),m=Math.floor((total%3600)/60),sec=total%60;return d?`${d}D ${pad(h)}:${pad(m)}:${pad(sec)}`:`${pad(h)}:${pad(m)}:${pad(sec)}`;}
  function values(e){return `<div class="calendar-values"><div><small>Actual</small><b>${esc(e.actual||'—')}</b></div><div><small>Forecast</small><b>${esc(e.forecast||'—')}</b></div><div><small>Previous</small><b>${esc(e.previous||'—')}</b></div></div>`;}
  function historyTable(e){const rows=Array.isArray(e.history)?e.history.slice(0,10):[];if(!rows.length)return'';return `<details class="release-history"><summary>Past releases (${rows.length})</summary><div class="history-scroll"><table><thead><tr><th>Date / Period</th><th>Actual</th><th>Forecast</th><th>Previous</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.dateTime||r.period||'—')}</td><td>${esc(r.actual||'—')}</td><td>${esc(r.forecast||'—')}</td><td>${esc(r.previous||'—')}</td></tr>`).join('')}</tbody></table></div></details>`;}
  function card(e,full=false){const stars='★'.repeat(Number(e.impact)||4);const source=e.sourceUrl?`<a class="event-source" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(e.sourceName||'Official source')} ↗</a>`:'';return `<article class="${full?'calendar-item':'market-event-row'}"><div class="${full?'calendar-date':'market-event-main'}"><span class="impact-badge impact-${e.impact}">${stars}</span><div><h3>${esc(e.name)}</h3><p class="event-zh">${esc(e.nameZh||'')}</p><p>${esc(fmt(e.datetime))}</p><strong class="event-countdown" data-date="${esc(e.datetime)}">${esc(countdown(e.datetime))}</strong></div></div>${full?`<div class="calendar-copy"><details><summary>为什么重要？</summary><p>${esc(e.whyZh||'此数据可能影响美元、利率预期与黄金波动。')}</p></details>${source}${historyTable(e)}</div>`:''}${values(e)}</article>`;}
  function updateCountdowns(){document.querySelectorAll('.event-countdown[data-date]').forEach(el=>el.textContent=countdown(el.dataset.date));}
  async function loadEvents(){const home=document.getElementById('homeMarketEvents'),full=document.getElementById('calendarList');if(!home&&!full)return;try{const r=await fetch(EVENTS_API,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Calendar unavailable');const events=(d.events||[]).filter(e=>Number(e.impact)>=4).sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));const relevant=events.filter(e=>new Date(e.datetime).getTime()>Date.now()-172800000);if(home)home.innerHTML=relevant.slice(0,3).map(e=>card(e,false)).join('')||'<div class="market-empty">No upcoming events.</div>';if(full)full.innerHTML=events.map(e=>card(e,true)).join('')||'<div class="market-empty">No events.</div>';const stamp=document.getElementById('calendarUpdated');if(stamp)stamp.textContent=`Last updated: ${new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'medium'}).format(new Date(d.updatedAt))} MYT`;updateCountdowns();}catch(e){const msg=`<div class="market-empty"><b>Calendar unavailable.</b><span>${esc(e.message)}</span></div>`;if(home)home.innerHTML=msg;if(full)full.innerHTML=msg;}}

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
  async function loadSnapshot(){try{const r=await fetch(SNAPSHOT_API,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Quote unavailable');setQuote('gold',d.gold?.price,d.gold?.changePct,d.gold?.timestamp||d.updatedAt);setQuote('dxy',d.dxy?.price,d.dxy?.changePct,d.dxy?.timestamp||d.updatedAt);const u=document.getElementById('marketSnapshotUpdated');if(u)u.textContent=d.updatedAt?`Updated ${new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(d.updatedAt))}`:'Delayed';}catch(e){setQuote('gold',null,null);setQuote('dxy',null,null);const u=document.getElementById('marketSnapshotUpdated');if(u)u.textContent='Using last known price';}}

  function drawEtfChart(records){const box=document.getElementById('etfChart');if(!box)return;if(records.length<2){box.innerHTML='<div class="market-empty compact">ETF history will appear after the daily sync.</div>';return;}const vals=records.map(x=>Number(x.holdings)).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const w=600,h=92,padX=8,padY=10;const pts=records.map((r,i)=>`${padX+i*(w-padX*2)/(records.length-1)},${padY+(max-Number(r.holdings))*(h-padY*2)/range}`).join(' ');box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"><defs><linearGradient id="etfFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b64b" stop-opacity=".32"/><stop offset="1" stop-color="#d8b64b" stop-opacity="0"/></linearGradient></defs><polygon points="${padX},${h-padY} ${pts} ${w-padX},${h-padY}" fill="url(#etfFill)"/><polyline points="${pts}" fill="none" stroke="#d8b64b" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;}
  async function loadEtf(){const summary=document.getElementById('etfSummary'),history=document.getElementById('etfHistory');if(!summary&&!history)return;try{const r=await fetch(ETF_DATA,{cache:'no-store'}),d=await r.json();const records=(d.records||[]).slice(0,30).sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(!records.length)throw new Error('Awaiting official SPDR daily sync');const latest=records.at(-1),prior=records.at(-2),change=prior?Number(latest.holdings)-Number(prior.holdings):Number(latest.change||0);summary.innerHTML=`<div><span>Current holdings</span><strong>${Number(latest.holdings).toFixed(2)} t</strong></div><div class="etf-daily ${change>0?'up':change<0?'down':'flat'}"><b>${change>0?'▲':change<0?'▼':'•'} ${change>0?'+':''}${change.toFixed(2)} t</b><span>${change>0?'Net inflow':change<0?'Net outflow':'Unchanged'}</span></div><small>Updated ${esc(latest.date)}</small>`;drawEtfChart(records);if(history)history.innerHTML=`<div class="history-scroll"><table><thead><tr><th>Date</th><th>Holdings</th><th>Daily change</th></tr></thead><tbody>${[...records].reverse().map((x,i,a)=>{const next=a[i+1],c=next?Number(x.holdings)-Number(next.holdings):Number(x.change||0);return `<tr><td>${esc(x.date)}</td><td>${Number(x.holdings).toFixed(2)} t</td><td>${(()=>{const n=Number(c);return `<span class=\"etf-change ${n>0?'up':n<0?'down':'flat'}\">${n>0?'▲':n<0?'▼':'•'} ${n>0?'+':''}${n.toFixed(2)} t</span>`})()}</td></tr>`}).join('')}</tbody></table></div>`;}catch(e){if(summary)summary.innerHTML=`<div class="market-empty compact">${esc(e.message)}</div>`;drawEtfChart([]);}}
  function setupEtfToggle(){const b=document.getElementById('toggleEtfHistory'),h=document.getElementById('etfHistory');if(!b||!h)return;b.addEventListener('click',()=>{h.hidden=!h.hidden;b.textContent=h.hidden?'View 30 Days →':'Hide 30 Days ↑';});}

  renderSessions();
  loadEvents();
  loadSnapshot();
  loadEtf();
  setupEtfToggle();
  setInterval(renderSessions,1000);
  setInterval(updateCountdowns,1000);
  setInterval(loadSnapshot,5000);
  setInterval(loadEvents,300000);
})();
