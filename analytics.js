(()=>{
  const send=(name,params={})=>{
    try{
      if(typeof window.gtag==='function') window.gtag('event',name,{...params,transport_type:'beacon'});
    }catch{}
  };
  const clean=s=>String(s||'').trim().slice(0,100);
  const page=location.pathname==='/'?'home':location.pathname.replace(/^\/+|\.html$/g,'').replace(/\//g,'_')||'home';
  const source=()=>{
    const u=new URL(location.href),utm=u.searchParams.get('utm_source'); if(utm)return clean(utm);
    if(!document.referrer)return 'direct';
    try{const h=new URL(document.referrer).hostname.toLowerCase();if(h.includes('google.'))return 'google';if(h.includes('facebook.')||h.includes('fb.'))return 'facebook';if(h.includes('instagram.'))return 'instagram';if(h.includes('tiktok.'))return 'tiktok';if(h.includes('xiaohongshu.')||h.includes('xhslink.'))return 'xiaohongshu';return h;}catch{return 'other';}
  };
  send('content_view',{page_name_custom:page,traffic_source_custom:source(),language_custom:navigator.language||'',device_type_custom:innerWidth<768?'mobile':'desktop'});
  const seen=new Set();
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(!e.isIntersecting||e.intersectionRatio<.55)return;
    const el=e.target,id=el.dataset.analyticsSection||el.id||el.getAttribute('aria-label'); if(!id||seen.has(id))return;
    seen.add(id); send('section_view',{page_name_custom:page,section_name:clean(id)});
  }),{threshold:[.55]});
  document.querySelectorAll('section,[data-analytics-section],main article').forEach((el,i)=>{if(!el.dataset.analyticsSection&&!el.id)el.dataset.analyticsSection=`section_${i+1}`;io.observe(el)});
  let max=0; addEventListener('scroll',()=>{const d=document.documentElement,h=Math.max(1,d.scrollHeight-innerHeight),p=Math.min(100,Math.round(scrollY/h*100));[25,50,75,90].forEach(x=>{if(p>=x&&max<x){max=x;send('scroll_depth',{page_name_custom:page,percent_scrolled:x})}})},{passive:true});
  addEventListener('click',e=>{
    const a=e.target.closest('a,button,[role="button"]'); if(!a)return;
    const text=clean(a.dataset.analyticsLabel||a.getAttribute('aria-label')||a.textContent);
    const href=a.href||'';
    if(/wa\.me|api\.whatsapp\.com|whatsapp/i.test(href)||/whatsapp/i.test(text)) send('whatsapp_click',{page_name_custom:page,button_location:clean(a.closest('section,[id]')?.id||'unknown'),button_name:text||'whatsapp'});
    else send('content_click',{page_name_custom:page,element_name:text||clean(href),section_name:clean(a.closest('section,[id]')?.id||'unknown')});
  },true);
  document.addEventListener('click',e=>{
    const card=e.target.closest('[data-event-type],[data-news-type]'); if(!card)return;
    send('news_interest',{page_name_custom:page,news_type:clean(card.dataset.eventType||card.dataset.newsType),news_name:clean(card.dataset.eventName||card.textContent)});
  },true);
  let activeStart=Date.now(),active=0; const flush=()=>{if(!document.hidden){active+=Date.now()-activeStart;activeStart=Date.now()} if(active>0)send('engaged_time',{page_name_custom:page,engaged_seconds:Math.round(active/1000)});active=0;};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){active+=Date.now()-activeStart}else activeStart=Date.now()});
  addEventListener('pagehide',flush);
})();
