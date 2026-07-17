(()=>{
  const MEASUREMENT_ID='G-RMTE7H8TP1';
  const VERSION='analytics-v2-sprint1';
  const clean=(value,max=100)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
  const pagePath=location.pathname||'/';
  const pageName=pagePath==='/'?'home':pagePath.replace(/^\/+|\.html$/g,'').replace(/\//g,'_')||'home';
  const nowIso=()=>new Date().toISOString();

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  if(!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"]`)){
    const script=document.createElement('script');
    script.async=true;
    script.src=`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
    window.gtag('js',new Date());
    window.gtag('config',MEASUREMENT_ID,{send_page_view:true,anonymize_ip:true});
  }

  const send=(name,params={})=>{
    try{
      window.gtag('event',name,{
        analytics_version:VERSION,
        page_name_custom:pageName,
        page_path_custom:pagePath,
        ...params,
        transport_type:'beacon'
      });
    }catch{}
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
      if(host===location.hostname)return {source:'internal',medium:'navigation',campaign:'(internal)'};
      if(host.includes('google.'))return {source:'google',medium:'organic',campaign:'(organic)'};
      if(host.includes('facebook.')||host.includes('fb.'))return {source:'facebook',medium:'organic_social',campaign:'(social)'};
      if(host.includes('instagram.'))return {source:'instagram',medium:'organic_social',campaign:'(social)'};
      if(host.includes('tiktok.'))return {source:'tiktok',medium:'organic_social',campaign:'(social)'};
      if(host.includes('xiaohongshu.')||host.includes('xhslink.'))return {source:'xiaohongshu',medium:'organic_social',campaign:'(social)'};
      return {source:host,medium:'referral',campaign:'(referral)'};
    }catch{return {source:'other',medium:'referral',campaign:'(unknown)'};}
  };

  const attribution=traffic();
  let first=attribution;
  try{
    first=JSON.parse(localStorage.getItem('gh_first_touch')||'null')||attribution;
    localStorage.setItem('gh_first_touch',JSON.stringify(first));
    localStorage.setItem('gh_last_touch',JSON.stringify(attribution));
  }catch{}
  send('content_view',{
    traffic_source_custom:attribution.source,
    language_custom:navigator.language||'',
    device_type_custom:innerWidth<768?'mobile':innerWidth<1100?'tablet':'desktop',
    first_source:first.source,first_medium:first.medium,first_campaign:first.campaign,
    last_source:attribution.source,last_medium:attribution.medium,last_campaign:attribution.campaign
  });

  const sectionName=element=>clean(
    element?.dataset?.analyticsSection||element?.id||element?.getAttribute?.('aria-label')||
    element?.querySelector?.('h1,h2,h3')?.textContent||'unknown'
  );
  const seenSections=new Set();
  const sectionEnteredAt=new Map();
  const visibleRatios=new Map();
  const currentSection=()=>{
    let best=null,bestRatio=0;
    for(const [element,ratio] of visibleRatios){if(ratio>bestRatio){bestRatio=ratio;best=element;}}
    return best?sectionName(best):([...seenSections].pop()||'unknown');
  };
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    const element=entry.target;
    const section=sectionName(element);
    if(!section||section==='unknown')return;
    if(entry.isIntersecting&&entry.intersectionRatio>=0.45){
      visibleRatios.set(element,entry.intersectionRatio);
      if(!sectionEnteredAt.has(element))sectionEnteredAt.set(element,Date.now());
      if(!seenSections.has(section)){
        seenSections.add(section);
        send('section_view',{page_section:section,section_name:section,section_id:section});
      }
    }else{
      visibleRatios.delete(element);
      if(sectionEnteredAt.has(element)){
        const seconds=Math.round((Date.now()-sectionEnteredAt.get(element))/1000);
        sectionEnteredAt.delete(element);
        if(seconds>=3)send('section_engagement',{page_section:section,section_id:section,engaged_seconds:seconds});
      }
    }
  }),{threshold:[0,0.45,0.75]});

  const observed=new WeakSet();
  const registerSections=(root=document)=>{
    const list=[];
    if(root.nodeType===1&&root.matches?.('section,[data-analytics-section],main article'))list.push(root);
    root.querySelectorAll?.('section,[data-analytics-section],main article').forEach(el=>list.push(el));
    list.forEach((element,index)=>{
      if(observed.has(element))return;
      observed.add(element);
      if(!element.dataset.analyticsSection&&!element.id){
        const heading=clean(element.querySelector?.('h1,h2,h3')?.textContent||'');
        element.dataset.analyticsSection=heading?heading.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''):`section_${index+1}`;
      }
      observer.observe(element);
    });
  };
  registerSections();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.nodeType===1)registerSections(node);
  }))).observe(document.body,{childList:true,subtree:true});

  let maxScroll=0;
  const scrollHandler=()=>{
    const doc=document.documentElement;
    const height=Math.max(1,doc.scrollHeight-innerHeight);
    const percent=Math.min(100,Math.round(scrollY/height*100));
    if(percent>maxScroll)maxScroll=percent;
  };
  addEventListener('scroll',scrollHandler,{passive:true});
  scrollHandler();

  const inferButtonLocation=element=>{
    if(element.classList?.contains('floating-whatsapp'))return 'floating_whatsapp';
    if(element.closest?.('.hero'))return 'hero';
    if(element.closest?.('#examples,.conversion-results'))return 'results';
    if(element.closest?.('#stories,.conversion-reviews'))return 'reviews';
    if(element.closest?.('#contact,.final-cta'))return 'final_cta';
    if(element.closest?.('footer'))return 'footer';
    return sectionName(element.closest?.('section,[data-analytics-section],[id]'));
  };

  addEventListener('click',event=>{
    const element=event.target.closest('a,button,[role="button"],summary');
    if(!element)return;
    const text=clean(element.dataset.analyticsLabel||element.getAttribute('aria-label')||element.textContent||element.title);
    const href=element.href||'';
    const section=inferButtonLocation(element);
    const common={page_section:section,section_name:section,section_id:section,element_name:text||clean(href)};
    if(/wa\.me|api\.whatsapp\.com|whatsapp/i.test(href)||/whatsapp/i.test(text)){
      send('whatsapp_click',{
        ...common,
        button_location:section,
        button_name:text||'whatsapp',
        whatsapp_type:element.dataset.whatsappType||(/floating/i.test(section)?'floating':'direct'),
        destination_host:(()=>{try{return new URL(href).hostname}catch{return 'whatsapp'}})()
      });
    }else if(element.tagName==='SUMMARY'){
      send('details_toggle',{...common,details_name:text,open_after_click:!element.parentElement?.open});
    }else{
      send('content_click',common);
    }
  },true);

  document.addEventListener('click',event=>{
    const card=event.target.closest('[data-event-type],[data-news-type]');
    if(!card)return;
    const type=clean(card.dataset.eventType||card.dataset.newsType);
    if(!type)return;
    send('news_interest',{
      news_type:type,
      news_name:clean(card.dataset.eventName||card.querySelector('h3,strong')?.textContent||card.textContent),
      page_section:'economic_news',
      section_id:'economic_news'
    });
  },true);

  document.querySelectorAll('video').forEach((video,index)=>{
    const label=clean(video.dataset.analyticsLabel||video.id||video.getAttribute('aria-label')||`video_${index+1}`);
    let started=false,completed=false;
    video.addEventListener('play',()=>{if(!started){started=true;send('video_start',{video_name:label});}});
    video.addEventListener('ended',()=>{if(!completed){completed=true;send('video_complete',{video_name:label});}});
  });

  let activeStarted=Date.now(),activeMs=0,visible=!document.hidden,lastExitSent=0;
  const pause=()=>{if(visible){activeMs+=Date.now()-activeStarted;visible=false;}};
  const resume=()=>{if(!visible){activeStarted=Date.now();visible=true;}};
  const flush=()=>{
    pause();
    const section=currentSection();
    if(activeMs>=5000)send('engaged_time',{engaged_seconds:Math.round(activeMs/1000),max_scroll_percent:maxScroll,last_section:section,event_time:nowIso()});
    // What visitors actually asked for: which part of the page they were reading right
    // before they left, instead of an abstract 25/50/75/90/100% scroll-depth number.
    if(Date.now()-lastExitSent>2000){
      lastExitSent=Date.now();
      send('exit_section',{page_section:section,section_id:section});
    }
    activeMs=0;
  };
  document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());
  addEventListener('pagehide',flush);
})();
