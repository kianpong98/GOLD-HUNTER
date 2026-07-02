
const WA_LINK = "https://wa.me/60133954958?text=Hi%20Gold%20Hunter,%20I%20would%20like%20to%20learn%20more%20about%20your%20membership.";

const loader=document.getElementById('loader');
window.addEventListener('load',()=>setTimeout(()=>loader?.classList.add('hide'),350));
setTimeout(()=>loader?.classList.add('hide'),1200); // safety cap

const nav=document.getElementById('navbar');
window.addEventListener('scroll',()=>nav?.classList.toggle('scrolled',window.scrollY>20));

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

/* V8 Mixed Media Gallery
   Results folder supports:
   result-001.png / result-002.jpg / result-003.webp / result-004.mp4 / result-005.mov / result-006.webm
   Reviews remain image-first:
   review-001.png / review-002.jpeg / review-003.webp
*/
const IMAGE_EXTENSIONS=['png','jpg','jpeg','webp','gif','avif'];
const VIDEO_EXTENSIONS=['mp4','webm','mov'];
const MEDIA_EXTENSIONS=[...IMAGE_EXTENSIONS,...VIDEO_EXTENSIONS];

const galleryState={results:[],reviews:[]};

function pad(num){return String(num).padStart(3,'0')}
function extensionOf(src){return (src.split('?')[0].split('.').pop()||'').toLowerCase()}
function mediaType(src){return VIDEO_EXTENSIONS.includes(extensionOf(src))?'video':'image'}
function mediaItem(src){return {src,type:mediaType(src)}}
async function loadManifest(url){
  try{
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) return null;
    const data=await res.json();
    if(Array.isArray(data)) return data.map(x=>typeof x==='string'?mediaItem(x):{src:x.src,type:x.type||mediaType(x.src),poster:x.poster||''}).filter(x=>x.src);
    return data;
  }catch(e){ return null; }
}

async function existsOnServer(src){
  const cacheBusted = src + '?v=' + Date.now();
  try{
    const res = await fetch(cacheBusted,{method:'HEAD',cache:'no-store'});
    if(res.ok) return src;
  }catch(e){}
  return null;
}
function checkImage(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(src);
    img.onerror=()=>resolve(null);
    img.src=src + '?v=' + Date.now();
  });
}
function checkVideo(src){
  return new Promise(resolve=>{
    const video=document.createElement('video');
    video.preload='metadata';
    video.muted=true;
    video.onloadedmetadata=()=>resolve(src);
    video.onerror=()=>resolve(null);
    video.src=src + '?v=' + Date.now();
  });
}
async function checkMedia(src,ext){
  const serverHit = await existsOnServer(src);
  if(serverHit) return serverHit;
  if(IMAGE_EXTENSIONS.includes(ext)) return await checkImage(src);
  return await checkVideo(src);
}
async function findMedia(folder,prefix,index,allowedExtensions=MEDIA_EXTENSIONS){
  for(const ext of allowedExtensions){
    const found=await checkMedia(`${folder}/${prefix}-${pad(index)}.${ext}`,ext);
    if(found) return mediaItem(found);
  }
  return null;
}
async function loadGallery(folder,prefix,max=220,allowedExtensions=MEDIA_EXTENSIONS){
  const manifest=await loadManifest(`${folder}/manifest.json`);
  if(Array.isArray(manifest) && manifest.length) return manifest;

  // Fallback for local/manual edits when manifest is missing.
  // Stops quickly after a few misses instead of checking hundreds of files.
  const items=[];
  let misses=0;
  for(let i=1;i<=Math.min(max,60);i++){
    const checks=allowedExtensions.map(ext=>checkMedia(`${folder}/${prefix}-${pad(i)}.${ext}`,ext).then(found=>found?mediaItem(found):null));
    const found=(await Promise.all(checks)).find(Boolean);
    if(found){items.push(found);misses=0;}
    else{misses++; if(misses>=3) break;}
  }
  return items;
}

async function discoverAdditionalMedia(folder,prefix,items,allowedExtensions=MEDIA_EXTENSIONS,scanLimit=80){
  // Background-only scan so new files added after the manifest still appear without slowing initial load.
  const existing=new Set(items.map(x=>x.src));
  const nums=items.map(x=>{
    const match=x.src.match(new RegExp(`${prefix}-(\\d+)`));
    return match?parseInt(match[1],10):0;
  });
  let start=(nums.length?Math.max(...nums):0)+1;
  const extra=[];
  let misses=0;
  for(let i=start;i<start+scanLimit;i++){
    const found=await findMedia(folder,prefix,i,allowedExtensions);
    if(found && !existing.has(found.src)){ extra.push(found); misses=0; }
    else{ misses++; if(misses>=3) break; }
  }
  return extra;
}

function updateGalleryButtons(){
  const rb=document.querySelector('[data-gallery="results"]');
  if(rb) rb.textContent = galleryState.results.length ? `View All Swing Trades (${galleryState.results.length}) →` : 'View All Swing Trades →';
  const vb=document.querySelector('[data-gallery="reviews"]');
  if(vb) vb.textContent = galleryState.reviews.length ? `View All Reviews (${galleryState.reviews.length}) →` : 'View All Reviews →';
}

function buildMediaMarkup(item,alt){
  if(item.type==='video'){
    return `<video muted loop playsinline preload="none" data-src="${item.src}" ${item.poster?`poster="${item.poster}"`:''}></video><em class="video-badge">▶ Video</em>`;
  }
  return `<img alt="${alt}" loading="lazy" decoding="async" src="${item.src}">`;
}

let insideManifestPromise=null;
async function findBaseMedia(baseName){
  // Use a small manifest so the page does not spend time probing every extension.
  if(!insideManifestPromise) insideManifestPromise=loadManifest('assets/inside-manifest.json');
  const manifest=await insideManifestPromise;
  if(manifest && manifest[baseName]) return {src:manifest[baseName].src,type:manifest[baseName].type||mediaType(manifest[baseName].src),poster:manifest[baseName].poster||''};

  // Fallback only if manifest is missing. Prefer video when both image and video exist.
  const preferred=[...VIDEO_EXTENSIONS,...IMAGE_EXTENSIONS];
  for(const ext of preferred){
    const src=`assets/${baseName}.${ext}`;
    const found=await checkMedia(src,ext);
    if(found) return mediaItem(found);
  }
  return null;
}
function renderInsideMedia(card,item){
  const slot=card.querySelector('.inside-media-slot') || card;
  const title=card.dataset.title || 'Gold Hunter media';
  card.dataset.lightbox=item.src;
  card.dataset.type=item.type;
  if(item.type==='video'){
    slot.innerHTML=`<video muted loop playsinline preload="none" data-src="${item.src}" ${item.poster?`poster="${item.poster}"`:''}></video><span class="video-badge inside-video-badge">▶ Video</span>`;
    const video=slot.querySelector('video');
    card.addEventListener('mouseenter',()=>{ prepareLazyVideo(video); video?.play().catch(()=>{}); });
    card.addEventListener('mouseleave',()=>{ if(video){video.pause(); video.currentTime=0;} });
  }else{
    slot.innerHTML=`<img alt="${title}" loading="lazy" decoding="async" src="${item.src}">`;
  }
  card.addEventListener('click',()=>{
    const gallery=[...document.querySelectorAll('[data-inside-media][data-lightbox]')]
      .map(el=>mediaItem(el.dataset.lightbox))
      .filter(x=>x.src);
    openMedia(item,gallery.length?gallery:[item]);
  });
}
async function initInsideMedia(){
  const cards=[...document.querySelectorAll('[data-inside-media]')];
  await Promise.all(cards.map(async card=>{
    const base=card.dataset.insideMedia;
    const item=await findBaseMedia(base);
    if(item) renderInsideMedia(card,item);
    else card.querySelector('.inside-media-slot')?.insertAdjacentHTML('beforeend','<div class="media-missing">Media not found</div>');
  }));
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
function attachVideoHover(tile){
  const video=tile.querySelector('video');
  if(!video) return;
  tile.addEventListener('mouseenter',()=>{
    prepareLazyVideo(video);
    video.play().catch(()=>{});
  });
  tile.addEventListener('mouseleave',()=>{
    video.pause();
    video.currentTime=0;
  });
}
function createResultTile(item,index){
  const article=document.createElement('article');
  article.className='result-tile' + (index===0?' featured':'');
  article.dataset.lightbox=item.src;
  article.dataset.type=item.type;
  article.innerHTML=`
    ${buildMediaMarkup(item,`Swing trade result ${index+1}`)}
    <div>
      <span>${index===0?'Featured Swing Trade':'Swing Trade'}</span>
      <h3>${index===0?'Big Pip Capture':'Recorded Pips'}</h3>
    </div>`;
  article.addEventListener('click',()=>openMedia(item,galleryState.results));
  attachVideoHover(article);
  return article;
}
function createReviewTile(item,index){
  const article=document.createElement('article');
  article.className='review-tile' + (index===0?' featured':'');
  article.dataset.lightbox=item.src;
  article.dataset.type=item.type;
  article.innerHTML=`<img alt="Member review ${index+1}" loading="lazy" decoding="async" src="${item.src}"><span>${index===0?'Member Feedback':'Real Conversation'}</span>`;
  article.addEventListener('click',()=>openMedia(item,galleryState.reviews));
  return article;
}
function renderPreview(containerId,items,type){
  const container=document.getElementById(containerId);
  if(!container)return;
  container.innerHTML='';
  items.slice(0,6).forEach((item,i)=>container.appendChild(type==='results'?createResultTile(item,i):createReviewTile(item,i)));
}
async function initDynamicGalleries(){
  const [results,reviews]=await Promise.all([
    loadGallery('assets/results','result',260,MEDIA_EXTENSIONS),
    loadGallery('assets/reviews','review',260,IMAGE_EXTENSIONS)
  ]);
  galleryState.results=results;
  galleryState.reviews=reviews;
  renderPreview('resultsGallery',results,'results');
  renderPreview('reviewsGallery',reviews,'reviews');

  // V11: counts and gallery items come from manifest.json only.
  // This prevents Cloudflare/SPA fallback from over-counting missing files.
  updateGalleryButtons();
}

/* Lightbox: image + video support */
const lb=document.getElementById('lightbox'),
      lbImg=document.getElementById('lightboxImg'),
      lbVideo=document.getElementById('lightboxVideo'),
      close=document.getElementById('closeLightbox'),
      prevBtn=document.getElementById('lightboxPrev'),
      nextBtn=document.getElementById('lightboxNext');

let currentGallery=[],currentIndex=0;

function normalizeGallery(gallery){
  return (gallery||[]).map(item=>{
    if(typeof item==='string') return mediaItem(item);
    return item;
  });
}
function showCurrentMedia(){
  if(!currentGallery.length) return;
  const item=currentGallery[currentIndex];

  if(lbImg){
    lbImg.style.display='none';
    lbImg.removeAttribute('src');
  }
  if(lbVideo){
    lbVideo.pause();
    lbVideo.style.display='none';
    lbVideo.removeAttribute('src');
    lbVideo.load();
  }

  if(item.type==='video' && lbVideo){
    lbVideo.src=item.src;
    lbVideo.style.display='block';
    lbVideo.currentTime=0;
    lbVideo.play().catch(()=>{});
  }else if(lbImg){
    lbImg.src=item.src;
    lbImg.style.display='block';
  }
}
function openMedia(item,gallery){
  const normalizedItem=typeof item==='string'?mediaItem(item):item;
  currentGallery=normalizeGallery(gallery&&gallery.length?gallery:[normalizedItem]);
  currentIndex=currentGallery.findIndex(x=>x.src===normalizedItem.src);
  if(currentIndex<0) currentIndex=0;
  showCurrentMedia();
  lb.classList.add('open');
  lb.setAttribute('aria-hidden','false');
}
function nextMedia(dir){
  if(!lb?.classList.contains('open') || !currentGallery.length)return;
  currentIndex=(currentIndex+dir+currentGallery.length)%currentGallery.length;
  showCurrentMedia();
}
function closeLb(){
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden','true');
  if(lbImg) lbImg.removeAttribute('src');
  if(lbVideo){
    lbVideo.pause();
    lbVideo.removeAttribute('src');
    lbVideo.load();
  }
  currentGallery=[];
}

function getGalleryForCard(card){
  if(card.closest('#examples') && galleryState.results.length) return galleryState.results;
  if(card.closest('#stories') && galleryState.reviews.length) return galleryState.reviews;
  const section=card.closest('section');
  if(!section) return [mediaItem(card.dataset.lightbox)];
  const items=[...section.querySelectorAll('[data-lightbox]')]
    .map(el=>mediaItem(el.dataset.lightbox))
    .filter(item=>item.src);
  return items.length ? items : [mediaItem(card.dataset.lightbox)];
}
function bindStaticLightboxes(){
  document.querySelectorAll('[data-lightbox]').forEach(card=>{
    if(card.closest('#resultsGallery') || card.closest('#reviewsGallery')) return;
    card.addEventListener('click',()=>openMedia(mediaItem(card.dataset.lightbox),getGalleryForCard(card)));
  });
}
document.querySelectorAll('[data-gallery]').forEach(btn=>btn.addEventListener('click',()=>{
  const type=btn.dataset.gallery;
  const gallery=type==='results'?galleryState.results:type==='reviews'?galleryState.reviews:[];
  if(gallery.length) openMedia(gallery[0],gallery);
}));

close?.addEventListener('click',closeLb);
prevBtn?.addEventListener('click',e=>{e.stopPropagation();nextMedia(-1)});
nextBtn?.addEventListener('click',e=>{e.stopPropagation();nextMedia(1)});
lb?.addEventListener('click',e=>{if(e.target===lb)closeLb()});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeLb();
  if(e.key==='ArrowRight')nextMedia(1);
  if(e.key==='ArrowLeft')nextMedia(-1);
});

bindStaticLightboxes();
initDynamicGalleries();
initInsideMedia();

/* Subtle card tilt */
document.querySelectorAll('.portfolio-card,.standard-card,.inside-card').forEach(el=>{
  el.addEventListener('mousemove',e=>{
    const r=el.getBoundingClientRect(),
          x=(e.clientX-r.left)/r.width-.5,
          y=(e.clientY-r.top)/r.height-.5;
    el.style.transform=`perspective(900px) rotateX(${(-y*3).toFixed(2)}deg) rotateY(${(x*3).toFixed(2)}deg) translateY(-5px)`;
  });
  el.addEventListener('mouseleave',()=>el.style.transform='');
});


/* Inside Gold Hunter video hover fallback */
document.querySelectorAll('.inside-card video').forEach(video=>{
  const card=video.closest('.inside-card');
  card?.addEventListener('mouseenter',()=>{ prepareLazyVideo(video); video.play().catch(()=>{}); });
  card?.addEventListener('mouseleave',()=>{ video.pause(); video.currentTime=0; });
});
