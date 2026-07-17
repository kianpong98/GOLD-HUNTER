
const WA_LINK = "https://wa.me/60133954958?text=Hi%20Gold%20Hunter,%20I%20would%20like%20to%20learn%20more%20about%20your%20membership.";

const loader=document.getElementById('loader');
window.addEventListener('load',()=>setTimeout(()=>loader?.classList.add('hide'),350));
setTimeout(()=>loader?.classList.add('hide'),1200); // safety cap

const nav=document.getElementById('navbar');
const sessionStrip=document.querySelector('.session-strip');
function syncHeaderStack(){
  if(!nav||!sessionStrip)return;
  // .navbar is position:fixed, so getBoundingClientRect() already gives its real
  // on-screen bottom edge for the current state (scrolled/unscrolled, any
  // breakpoint) — session-strip's top always matches it exactly, with no more
  // guessed magic-number pixel gaps that drift out of sync when the navbar's
  // height changes (e.g. on scroll).
  const bottom=nav.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--session-strip-top',`${Math.max(0,Math.round(bottom))}px`);
}
syncHeaderStack();
window.addEventListener('scroll',()=>{nav?.classList.toggle('scrolled',window.scrollY>20);syncHeaderStack();});
window.addEventListener('resize',syncHeaderStack);
window.addEventListener('load',syncHeaderStack);
document.fonts?.ready?.then(syncHeaderStack).catch(()=>{});

const menu=document.getElementById('menuToggle'),links=document.getElementById('navLinks');
menu?.addEventListener('click',()=>links?.classList.toggle('open'));
links?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')));

const glow=document.getElementById('cursorGlow');
window.addEventListener('mousemove',e=>{
  if(!glow)return;
  glow.style.opacity=1;
  glow.style.left=e.clientX+'px';
  glow.style.top=e.clientY+'px';
});

let counted=new WeakSet();
function runCounter(el){
  if(counted.has(el))return;
  counted.add(el);
  const target=+el.dataset.counter;
  const duration=1400,t0=performance.now();
  function tick(now){
    const p=Math.min((now-t0)/duration,1);
    const val=Math.floor(target*(1-Math.pow(1-p,3)));
    el.textContent=val.toLocaleString()+'+';
    if(p<1)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const io=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      entry.target.querySelectorAll?.('[data-counter]').forEach(runCounter);
    }
  });
},{threshold:.18});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));


/* Gold Hunter Stable Gallery Engine v18
   - Homepage shows latest 6 Results / Reviews only
   - Show More opens Apple-style full grid
   - Tap any item to open swipe viewer
   - Uses manifest.json as source of truth, then performs a short one-time scan for newly added continuous files
*/
const IMAGE_EXTENSIONS=['png','jpg','jpeg','webp','gif','avif'];
const VIDEO_EXTENSIONS=['mp4','webm','mov'];
const MEDIA_EXTENSIONS=[...IMAGE_EXTENSIONS,...VIDEO_EXTENSIONS];
const CACHE_VERSION='gh-v18-stable-gallery';
const galleryState={results:[],reviews:[]};

function pad(num){return String(num).padStart(3,'0')}
function extensionOf(src){return (src.split('?')[0].split('.').pop()||'').toLowerCase()}
function mediaType(src){return VIDEO_EXTENSIONS.includes(extensionOf(src))?'video':'image'}
function normalizePath(folder,src){
  if(!src) return '';
  if(src.startsWith('http') || src.startsWith('/') || src.startsWith(folder+'/')) return src;
  return `${folder}/${src}`;
}
function mediaItem(src,folder='',poster=''){
  const finalSrc=folder?normalizePath(folder,src):src;
  return {src:finalSrc,type:mediaType(finalSrc),poster:poster?normalizePath(folder,poster):''};
}
function mediaNumber(src,prefix){
  const match=(src||'').match(new RegExp(`${prefix}-(\\d+)`));
  return match?parseInt(match[1],10):0;
}
function sortLatestFirst(items,prefix){
  return [...(items||[])].sort((a,b)=>mediaNumber(b.src,prefix)-mediaNumber(a.src,prefix));
}
function uniqueBySrc(items){
  const seen=new Set();
  return items.filter(item=>{
    if(!item?.src || seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}
async function loadManifest(folder){
  try{
    const res=await fetch(`${folder}/manifest.json?v=${CACHE_VERSION}`,{cache:'no-store'});
    if(!res.ok) return [];
    const data=await res.json();
    if(!Array.isArray(data)) return [];
    return data.map(x=>{
      if(typeof x==='string') return mediaItem(x,folder);
      return {src:normalizePath(folder,x.src),type:x.type||mediaType(x.src),poster:x.poster?normalizePath(folder,x.poster):''};
    }).filter(x=>x.src);
  }catch(e){
    console.warn('Manifest load failed',folder,e);
    return [];
  }
}
function testImage(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(true);
    img.onerror=()=>resolve(false);
    img.src=`${src}?v=${CACHE_VERSION}`;
  });
}
function testVideo(src){
  return new Promise(resolve=>{
    const video=document.createElement('video');
    video.preload='metadata';
    video.muted=true;
    video.onloadedmetadata=()=>resolve(true);
    video.onerror=()=>resolve(false);
    video.src=`${src}?v=${CACHE_VERSION}`;
  });
}
async function findMediaByNumber(folder,prefix,num,allowedExtensions=MEDIA_EXTENSIONS){
  for(const ext of allowedExtensions){
    const src=`${folder}/${prefix}-${pad(num)}.${ext}`;
    const ok=VIDEO_EXTENSIONS.includes(ext)?await testVideo(src):await testImage(src);
    if(ok) return mediaItem(src);
  }
  return null;
}
async function scanContinuousFallback(folder,prefix,allowedExtensions=MEDIA_EXTENSIONS){
  // Fallback only when manifest.json is missing/empty.
  // Keep the limit conservative so it never creates fake 90/192 item counts.
  const fallback=[];
  let misses=0;
  for(let i=1;i<=60;i++){
    const item=await findMediaByNumber(folder,prefix,i,allowedExtensions);
    if(item){fallback.push(item); misses=0;}
    else{misses++; if(misses>=3) break;}
  }
  return fallback;
}
async function loadStableGallery(folder,prefix,allowedExtensions=MEDIA_EXTENSIONS){
  const manifestItems=uniqueBySrc(await loadManifest(folder));
  // Manifest is now the source of truth.
  // This prevents disappearing images and wrong counts like 90/192 after Cloudflare/browser cache refresh.
  let items=manifestItems.length ? manifestItems : await scanContinuousFallback(folder,prefix,allowedExtensions);
  return sortLatestFirst(uniqueBySrc(items),prefix);
}

function prepareLazyVideo(video){
  if(!video || video.dataset.ready==='1') return;
  const src=video.dataset.src || video.getAttribute('src');
  if(src){
    video.src=src;
    video.dataset.ready='1';
    video.load();
  }
}
function mediaMarkup(item,alt,thumb=false){
  if(item.type==='video'){
    return `<video muted loop playsinline preload="metadata" data-src="${item.src}" ${item.poster?`poster="${item.poster}"`:''}></video><em class="video-badge">▶ Video</em>`;
  }
  return `<img alt="${alt}" loading="lazy" decoding="async" src="${item.src}">`;
}
function attachVideoHover(el){
  const video=el.querySelector('video');
  if(!video) return;
  el.addEventListener('mouseenter',()=>{prepareLazyVideo(video); video.play().catch(()=>{});});
  el.addEventListener('mouseleave',()=>{video.pause(); video.currentTime=0;});
}
function createResultTile(item,index){
  const article=document.createElement('article');
  article.className='result-tile' + (index===0?' featured':'');
  article.innerHTML=`${mediaMarkup(item,`Swing trade result ${index+1}`)}
    <div><span>${index===0?'Latest Swing Trade':'Swing Trade'}</span><h3>${index===0?'Big Pip Capture':'Recorded Pips'}</h3></div>`;
  article.addEventListener('click',()=>openViewer(item,galleryState.results));
  attachVideoHover(article);
  return article;
}
function createReviewTile(item,index){
  const article=document.createElement('article');
  article.className='review-tile' + (index===0?' featured':'');
  article.innerHTML=`${mediaMarkup(item,`Member review ${index+1}`)}<span>${index===0?'Latest Feedback':'Real Conversation'}</span>`;
  article.addEventListener('click',()=>openViewer(item,galleryState.reviews));
  return article;
}
function renderPreview(containerId,items,type){
  const container=document.getElementById(containerId);
  if(!container) return;
  container.innerHTML='';
  items.slice(0,6).forEach((item,i)=>container.appendChild(type==='results'?createResultTile(item,i):createReviewTile(item,i)));
}
function updateGalleryButtons(){
  const rb=document.querySelector('[data-gallery="results"]');
  if(rb) rb.textContent=galleryState.results.length?`Show More Results (${galleryState.results.length}) →`:'Show More Results →';
  const vb=document.querySelector('[data-gallery="reviews"]');
  if(vb) vb.textContent=galleryState.reviews.length?`Show More Reviews (${galleryState.reviews.length}) →`:'Show More Reviews →';
}

/* Inside Gold Hunter media */
let insideManifestPromise=null;
async function findInsideMedia(baseName){
  if(!insideManifestPromise) insideManifestPromise=loadManifest('assets').then(()=>fetch('assets/inside-manifest.json?v='+CACHE_VERSION,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})));
  const manifest=await insideManifestPromise;
  if(manifest && manifest[baseName]){
    const m=manifest[baseName];
    return {src:m.src,type:m.type||mediaType(m.src),poster:m.poster||''};
  }
  for(const ext of [...VIDEO_EXTENSIONS,...IMAGE_EXTENSIONS]){
    const src=`assets/${baseName}.${ext}`;
    const ok=VIDEO_EXTENSIONS.includes(ext)?await testVideo(src):await testImage(src);
    if(ok) return mediaItem(src);
  }
  return null;
}
async function initInsideMedia(){
  const cards=[...document.querySelectorAll('[data-inside-media]')];
  await Promise.all(cards.map(async card=>{
    const item=await findInsideMedia(card.dataset.insideMedia);
    const slot=card.querySelector('.inside-media-slot') || card;
    if(!item){ slot.insertAdjacentHTML('beforeend','<div class="media-missing">Media not found</div>'); return; }
    card.dataset.lightbox=item.src;
    card.dataset.type=item.type;
    slot.innerHTML=mediaMarkup(item,card.dataset.title||'Gold Hunter media');
    attachVideoHover(card);
    card.addEventListener('click',()=>{
      const gallery=[...document.querySelectorAll('[data-inside-media][data-lightbox]')].map(el=>mediaItem(el.dataset.lightbox));
      openViewer(item,gallery);
    });
  }));
}

/* Apple-style grid browser */
const galleryBrowser=document.getElementById('galleryBrowser'),
      galleryBrowserGrid=document.getElementById('galleryBrowserGrid'),
      galleryBrowserTitle=document.getElementById('galleryBrowserTitle'),
      galleryBrowserSub=document.getElementById('galleryBrowserSub'),
      galleryBrowserEyebrow=document.getElementById('galleryBrowserEyebrow'),
      closeGalleryBrowser=document.getElementById('closeGalleryBrowser');
let gridHistoryActive=false;
function openGalleryGrid(type){
  const gallery=type==='results'?galleryState.results:galleryState.reviews;
  if(!gallery.length) return;
  const isResults=type==='results';
  galleryBrowserEyebrow.textContent=isResults?'SWING TRADE ARCHIVE':'MEMBER REVIEW ARCHIVE';
  galleryBrowserTitle.textContent=isResults?'All Swing Results':'All Member Reviews';
  galleryBrowserSub.textContent=`${gallery.length} items. Tap any item to open, then swipe left or right.`;
  galleryBrowserGrid.innerHTML='';
  gallery.forEach((item,index)=>{
    const card=document.createElement('button');
    card.type='button';
    card.className='gallery-browser-item';
    card.dataset.index=`${index+1} / ${gallery.length}`;
    card.innerHTML=mediaMarkup(item,`${isResults?'Swing result':'Member review'} ${index+1}`,true);
    card.addEventListener('click',()=>openViewer(item,gallery));
    attachVideoHover(card);
    galleryBrowserGrid.appendChild(card);
  });
  galleryBrowser.classList.add('open');
  galleryBrowser.setAttribute('aria-hidden','false');
  document.body.classList.add('gallery-browser-active');
  if(!gridHistoryActive){history.pushState({ghGrid:true},''); gridHistoryActive=true;}
}
function closeGalleryGrid(useHistory=true){
  if(!galleryBrowser?.classList.contains('open')) return;
  if(useHistory && gridHistoryActive){history.back(); return;}
  galleryBrowser.classList.remove('open');
  galleryBrowser.setAttribute('aria-hidden','true');
  document.body.classList.remove('gallery-browser-active');
  gridHistoryActive=false;
}
closeGalleryBrowser?.addEventListener('click',()=>closeGalleryGrid());
galleryBrowser?.addEventListener('click',e=>{if(e.target===galleryBrowser) closeGalleryGrid();});
document.querySelectorAll('[data-gallery]').forEach(btn=>btn.addEventListener('click',()=>openGalleryGrid(btn.dataset.gallery)));

/* Apple-style viewer */
const lb=document.getElementById('lightbox'),
      lbCounter=document.getElementById('lightboxCounter'),
      lbImg=document.getElementById('lightboxImg'),
      lbVideo=document.getElementById('lightboxVideo'),
      close=document.getElementById('closeLightbox'),
      prevBtn=document.getElementById('lightboxPrev'),
      nextBtn=document.getElementById('lightboxNext'),
      lbStage=document.getElementById('lightboxStage');
let viewerGallery=[],viewerIndex=0,viewerHistoryActive=false;
let zoomScale=1,panX=0,panY=0,touchStartX=0,touchStartY=0,touchStartTime=0,lastTap=0,pinchStartDistance=0,pinchStartScale=1;
function normalizeGallery(gallery){return (gallery||[]).map(x=>typeof x==='string'?mediaItem(x):x).filter(x=>x?.src);}
function currentEl(){return viewerGallery[viewerIndex]?.type==='video'?lbVideo:lbImg;}
function applyTransform(){const el=currentEl(); if(el) el.style.transform=`translate(${panX}px, ${panY}px) scale(${zoomScale})`;}
function resetTransform(){zoomScale=1; panX=0; panY=0; applyTransform();}
function showViewerItem(){
  const item=viewerGallery[viewerIndex]; if(!item) return;
  if(lbImg){lbImg.style.display='none'; lbImg.removeAttribute('src'); lbImg.style.transform='';}
  if(lbVideo){lbVideo.pause(); lbVideo.style.display='none'; lbVideo.removeAttribute('src'); lbVideo.style.transform=''; lbVideo.load();}
  if(item.type==='video' && lbVideo){lbVideo.src=item.src; lbVideo.style.display='block'; lbVideo.currentTime=0; lbVideo.play().catch(()=>{});}
  else if(lbImg){lbImg.src=item.src; lbImg.style.display='block';}
  lbCounter.textContent=`${viewerIndex+1} / ${viewerGallery.length}`;
  resetTransform();
}
function openViewer(item,gallery){
  const normalized=typeof item==='string'?mediaItem(item):item;
  viewerGallery=normalizeGallery(gallery?.length?gallery:[normalized]);
  viewerIndex=viewerGallery.findIndex(x=>x.src===normalized.src);
  if(viewerIndex<0) viewerIndex=0;
  showViewerItem();
  lb.classList.add('open');
  lb.setAttribute('aria-hidden','false');
  document.body.classList.add('lightbox-active');
  if(!viewerHistoryActive){history.pushState({ghViewer:true},''); viewerHistoryActive=true;}
}
function moveViewer(dir){
  if(!lb?.classList.contains('open') || !viewerGallery.length) return;
  viewerIndex=(viewerIndex+dir+viewerGallery.length)%viewerGallery.length;
  showViewerItem();
}
function closeViewer(useHistory=true){
  if(!lb?.classList.contains('open')) return;
  if(useHistory && viewerHistoryActive){history.back(); return;}
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden','true');
  document.body.classList.remove('lightbox-active');
  if(lbImg) lbImg.removeAttribute('src');
  if(lbVideo){lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load();}
  viewerGallery=[];
  viewerHistoryActive=false;
}
function distance(touches){const a=touches[0],b=touches[1]; return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
function onTouchStart(e){
  if(e.touches.length===2){pinchStartDistance=distance(e.touches); pinchStartScale=zoomScale; return;}
  const t=e.touches[0]; touchStartX=t.clientX; touchStartY=t.clientY; touchStartTime=Date.now();
}
function onTouchMove(e){
  if(e.touches.length===2){e.preventDefault(); zoomScale=Math.min(3.5,Math.max(1,pinchStartScale*(distance(e.touches)/pinchStartDistance))); applyTransform(); return;}
  if(e.touches.length===1 && zoomScale>1){e.preventDefault(); const t=e.touches[0]; panX=(t.clientX-touchStartX)*0.8; panY=(t.clientY-touchStartY)*0.8; applyTransform();}
}
function onTouchEnd(e){
  if(e.changedTouches.length===0) return;
  const t=e.changedTouches[0],dx=t.clientX-touchStartX,dy=t.clientY-touchStartY,elapsed=Date.now()-touchStartTime,now=Date.now();
  if(elapsed<260 && Math.abs(dx)<18 && Math.abs(dy)<18){
    if(now-lastTap<320){zoomScale=zoomScale>1?1:2; panX=0; panY=0; applyTransform();}
    lastTap=now; return;
  }
  if(zoomScale>1) return;
  if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.2){moveViewer(dx<0?1:-1); return;}
  if(dy>90 && Math.abs(dy)>Math.abs(dx)*1.2){closeViewer();}
}
close?.addEventListener('click',()=>closeViewer());
prevBtn?.addEventListener('click',e=>{e.stopPropagation();moveViewer(-1)});
nextBtn?.addEventListener('click',e=>{e.stopPropagation();moveViewer(1)});
lb?.addEventListener('click',e=>{if(e.target===lb) closeViewer();});
lbStage?.addEventListener('touchstart',onTouchStart,{passive:false});
lbStage?.addEventListener('touchmove',onTouchMove,{passive:false});
lbStage?.addEventListener('touchend',onTouchEnd,{passive:true});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(lb?.classList.contains('open')) closeViewer();
    else if(galleryBrowser?.classList.contains('open')) closeGalleryGrid();
  }
  if(e.key==='ArrowRight') moveViewer(1);
  if(e.key==='ArrowLeft') moveViewer(-1);
});
window.addEventListener('popstate',()=>{
  if(lb?.classList.contains('open')){closeViewer(false); return;}
  if(galleryBrowser?.classList.contains('open')){closeGalleryGrid(false); return;}
});

async function initDynamicGalleries(){
  galleryState.results=await loadStableGallery('assets/results','result',MEDIA_EXTENSIONS);
  galleryState.reviews=await loadStableGallery('assets/reviews','review',IMAGE_EXTENSIONS);
  renderPreview('resultsGallery',galleryState.results,'results');
  renderPreview('reviewsGallery',galleryState.reviews,'reviews');
  updateGalleryButtons();
}

initDynamicGalleries();
initInsideMedia();
