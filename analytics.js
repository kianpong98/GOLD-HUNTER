(()=>{
  const MEASUREMENT_ID='G-RMTE7H8TP1';
  const clean=(value,max=100)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
  const pagePath=location.pathname||'/';
  const pageName=pagePath==='/'?'home':pagePath.replace(/^\/+|\.html$/g,'').replace(/\//g,'_')||'home';

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  if(!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)){
    const script=document.createElement('script');
    script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
    window.gtag('js',new Date());
    window.gtag('config',MEASUREMENT_ID,{send_page_view:true,anonymize_ip:true});
  }

  const send=(name,params={})=>{
    try{window.gtag('event',name,{...params,transport_type:'beacon'});}catch{}
  };
  const traffic=()=>{
    const url=new URL(location.href);
    const utmSource=clean(url.searchParams.get('utm_source'));
    const utmMedium=clean(url.searchParams.get('utm_medium'));
    const utmCampaign=clean(url.searchParams.get('utm_campaign'));
    if(utmSource)return {source:utmSource,medium:utmMedium||'utm',campaign:utmCampaign||'(not set)'};
    if(!document.referrer)return {source:'direct',medium:'none',campaign:'(direct)'};
    try{
      const host=new URL(document.referrer).hostname.toLowerCase();
      if(host.includes('google.'))return {source:'google',medium:'organic',campaign:'(organic)'};
      if(host.includes('facebook.')||host.includes('fb.'))return {source:'facebook',medium:'organic_social',campaign:'(social)'};
      if(host.includes('instagram.'))return {source:'instagram',medium:'organic_social',campaign:'(social)'};
      if(host.includes('tiktok.'))return {source:'tiktok',medium:'organic_social',campaign:'(social)'};
      if(host.includes('xiaohongshu.')||host.includes('xhslink.'))return {source:'xiaohongshu',medium:'organic_social',campaign:'(social)'};
      return {source:host,medium:'referral',campaign:'(referral)'};
    }catch{return {source:'other',medium:'referral',campaign:'(unknown)'};}
  };
  const attribution=traffic();
  try{
    const first=JSON.parse(localStorage.getItem('gh_first_touch')||'null')||attribution;
    localStorage.setItem('gh_first_touch',JSON.stringify(first));
    localStorage.setItem('gh_last_touch',JSON.stringify(attribution));
    send('content_view',{
      page_name_custom:pageName,page_path_custom:pagePath,
      traffic_source_custom:attribution.source,language_custom:navigator.language||'',
      device_type_custom:innerWidth<768?'mobile':innerWidth<1100?'tablet':'desktop',
      first_source:first.source,first_medium:first.medium,first_campaign:first.campaign,
      last_source:attribution.source,last_medium:attribution.medium,last_campaign:attribution.campaign
    });
  }catch{send('content_view',{page_name_custom:pageName,page_path_custom:pagePath});}

  const seen=new Set();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting||entry.intersectionRatio<0.55)return;
    const element=entry.target;
    const section=clean(element.dataset.analyticsSection||element.id||element.getAttribute('aria-label')||'unknown');
    if(!section||seen.has(section))return;
    seen.add(section);
    send('section_view',{page_name_custom:pageName,page_section:section,section_name:section,section_id:section});
  }),{threshold:[0.55]});
  document.querySelectorAll('section,[data-analytics-section],main article').forEach((element,index)=>{
    if(!element.dataset.analyticsSection&&!element.id)element.dataset.analyticsSection=`section_${index+1}`;
    observer.observe(element);
  });

  let maxScroll=0;
  const scrollHandler=()=>{
    const doc=document.documentElement;
    const height=Math.max(1,doc.scrollHeight-innerHeight);
    const percent=Math.min(100,Math.round(scrollY/height*100));
    [25,50,75,90].forEach(mark=>{
      if(percent>=mark&&maxScroll<mark){
        maxScroll=mark;
        send('scroll_depth',{page_name_custom:pageName,percent_scrolled:mark,page_section:clean(document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('section,[id]')?.id||'unknown')});
      }
    });
  };
  addEventListener('scroll',scrollHandler,{passive:true});

  addEventListener('click',event=>{
    const element=event.target.closest('a,button,[role="button"]');
    if(!element)return;
    const text=clean(element.dataset.analyticsLabel||element.getAttribute('aria-label')||element.textContent||element.title);
    const href=element.href||'';
    const section=clean(element.closest('section,[data-analytics-section],[id]')?.dataset.analyticsSection||element.closest('section,[id]')?.id||'unknown');
    const common={page_name_custom:pageName,page_section:section,section_name:section,section_id:section,element_name:text||clean(href)};
    if(/wa\.me|api\.whatsapp\.com|whatsapp/i.test(href)||/whatsapp/i.test(text)){
      send('whatsapp_click',{...common,button_location:section,button_name:text||'whatsapp',whatsapp_type:element.dataset.whatsappType||'direct'});
    }else{
      send('content_click',common);
    }
  },true);

  document.addEventListener('click',event=>{
    const card=event.target.closest('[data-event-type],[data-news-type]');
    if(!card)return;
    const type=clean(card.dataset.eventType||card.dataset.newsType);
    send('news_interest',{page_name_custom:pageName,news_type:type,news_name:clean(card.dataset.eventName||card.textContent),page_section:'economic_news'});
  },true);

  document.querySelectorAll('video').forEach((video,index)=>{
    const label=clean(video.dataset.analyticsLabel||video.id||video.getAttribute('aria-label')||`video_${index+1}`);
    let started=false,completed=false;
    video.addEventListener('play',()=>{if(!started){started=true;send('video_start',{page_name_custom:pageName,video_name:label});}});
    video.addEventListener('ended',()=>{if(!completed){completed=true;send('video_complete',{page_name_custom:pageName,video_name:label});}});
  });

  let activeStarted=Date.now(),activeMs=0;
  const pause=()=>{if(!document.hidden){activeMs+=Date.now()-activeStarted;}};
  const resume=()=>{activeStarted=Date.now();};
  const flush=()=>{
    pause();
    if(activeMs>=5000)send('engaged_time',{page_name_custom:pageName,engaged_seconds:Math.round(activeMs/1000),max_scroll_percent:maxScroll});
    activeMs=0;
  };
  document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
  addEventListener('pagehide',flush);
})();
