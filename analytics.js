/* Gold Hunter Analytics Pro v1.0
   GA4 attribution + WhatsApp conversion + engagement tracking.
   Measurement ID: G-RMTE7H8TP1
*/
(() => {
  'use strict';

  const MEASUREMENT_ID = 'G-RMTE7H8TP1';
  const FIRST_TOUCH_KEY = 'gh_first_touch_v1';
  const LAST_TOUCH_KEY = 'gh_last_touch_v1';
  const SESSION_KEY = 'gh_session_v1';
  const MAX_PATH_STEPS = 20;

  const safeParse = (value, fallback = {}) => {
    try { return JSON.parse(value) || fallback; } catch { return fallback; }
  };
  const clean = (value, max = 100) => String(value || '').trim().slice(0, max);
  const nowIso = () => new Date().toISOString();
  const params = new URLSearchParams(location.search);

  function normalizeSource(raw, referrerHost) {
    const value = clean(raw, 80).toLowerCase();
    const host = clean(referrerHost, 120).toLowerCase();
    const haystack = `${value} ${host}`;
    if (/instagram|l\.instagram/.test(haystack)) return 'instagram';
    if (/facebook|fb\.com|l\.facebook/.test(haystack)) return 'facebook';
    if (/tiktok/.test(haystack)) return 'tiktok';
    if (/xiaohongshu|xhslink|rednote/.test(haystack)) return 'xiaohongshu';
    if (/google/.test(haystack)) return 'google';
    if (/bing/.test(haystack)) return 'bing';
    if (/youtube|youtu\.be/.test(haystack)) return 'youtube';
    if (/telegram|t\.me/.test(haystack)) return 'telegram';
    if (/whatsapp|wa\.me/.test(haystack)) return 'whatsapp';
    if (value) return value;
    if (host) return host.replace(/^www\./, '');
    return 'direct';
  }

  function currentTouch() {
    let referrerHost = '';
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch {}
    const utmSource = params.get('utm_source');
    const source = normalizeSource(utmSource, referrerHost);
    let medium = clean(params.get('utm_medium'), 80);
    if (!medium) {
      if (source === 'direct') medium = 'none';
      else if (['google', 'bing'].includes(source)) medium = 'organic';
      else if (['instagram', 'facebook', 'tiktok', 'xiaohongshu', 'youtube', 'telegram', 'whatsapp'].includes(source)) medium = 'social';
      else medium = 'referral';
    }
    return {
      source,
      medium,
      campaign: clean(params.get('utm_campaign'), 100) || '(not set)',
      content: clean(params.get('utm_content'), 100) || '(not set)',
      term: clean(params.get('utm_term'), 100) || '(not set)',
      landing_page: clean(location.pathname + location.search, 300),
      referrer: clean(document.referrer || '(direct)', 300),
      captured_at: nowIso()
    };
  }

  const touch = currentTouch();
  const hasCampaignSignal = [...params.keys()].some(k => k.startsWith('utm_')) || document.referrer;
  let firstTouch = safeParse(localStorage.getItem(FIRST_TOUCH_KEY), null);
  if (!firstTouch) {
    firstTouch = touch;
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
  }
  let lastTouch = safeParse(localStorage.getItem(LAST_TOUCH_KEY), null);
  if (!lastTouch || hasCampaignSignal) {
    lastTouch = touch;
    localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(lastTouch));
  }
  lastTouch = lastTouch || touch;

  let session = safeParse(sessionStorage.getItem(SESSION_KEY), null);
  if (!session) {
    session = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      started_at: nowIso(),
      landing_page: clean(location.pathname + location.search, 300),
      path: []
    };
  }
  const currentPath = clean(location.pathname + location.search, 300);
  if (session.path[session.path.length - 1] !== currentPath) {
    session.path.push(currentPath);
    session.path = session.path.slice(-MAX_PATH_STEPS);
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  const common = () => ({
    page_path: clean(location.pathname, 200),
    page_title: clean(document.title, 150),
    language: clean(document.documentElement.lang || navigator.language, 20),
    session_id: session.id,
    first_source: firstTouch.source,
    first_medium: firstTouch.medium,
    first_campaign: firstTouch.campaign,
    last_source: lastTouch.source,
    last_medium: lastTouch.medium,
    last_campaign: lastTouch.campaign,
    landing_page: session.landing_page
  });

  function track(name, details = {}) {
    window.gtag('event', name, { ...common(), ...details });
  }

  // Set user-scoped attribution properties for GA4 Explorations.
  window.gtag('set', 'user_properties', {
    gh_first_source: firstTouch.source,
    gh_first_medium: firstTouch.medium,
    gh_first_campaign: firstTouch.campaign
  });

  function buttonLocation(el) {
    if (el.classList.contains('floating-whatsapp')) return 'floating_whatsapp';
    if (el.closest('nav, .navbar, #navbar')) return 'navbar';
    if (el.closest('header, .hero')) return 'hero';
    if (el.closest('footer')) return 'footer';
    if (el.closest('#framework, .package-card, .membership')) return 'membership';
    const section = el.closest('section[id]');
    if (section?.id) return clean(section.id, 60);
    return clean(el.id || el.className || 'unknown', 60);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.href || '';
    const text = clean(link.textContent || link.getAttribute('aria-label'), 100);
    if (/wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com/i.test(href)) {
      const kind = /chat\.whatsapp\.com/i.test(href) ? 'community_invite' : 'direct_message';
      track('whatsapp_click', {
        button_location: buttonLocation(link),
        button_text: text,
        whatsapp_type: kind,
        destination_domain: (() => { try { return new URL(href).hostname; } catch { return ''; } })(),
        page_section: clean(link.closest('section[id]')?.id || '', 60),
        journey_path: clean(session.path.join(' > '), 500),
        transport_type: 'beacon'
      });
    }
  }, true);

  // Scroll milestones once per page.
  const sentScroll = new Set();
  function checkScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    const pct = max <= 0 ? 100 : Math.round((scrollY / max) * 100);
    [25, 50, 75, 90, 100].forEach(mark => {
      if (pct >= mark && !sentScroll.has(mark)) {
        sentScroll.add(mark);
        track('scroll_depth', { percent_scrolled: mark });
      }
    });
  }
  addEventListener('scroll', checkScroll, { passive: true });
  addEventListener('load', checkScroll, { once: true });

  // Section visibility funnel.
  const observed = new Set();
  const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || observed.has(entry.target)) return;
      observed.add(entry.target);
      track('section_view', {
        section_id: clean(entry.target.id || 'unnamed', 60),
        section_name: clean(entry.target.querySelector('h1,h2,h3')?.textContent || '', 100)
      });
    });
  }, { threshold: 0.35 }) : null;
  sectionObserver && document.querySelectorAll('section[id]').forEach(s => sectionObserver.observe(s));

  // Gallery, show-more and media engagement using delegated events.
  document.addEventListener('click', event => {
    const showMore = event.target.closest('[data-gallery]');
    if (showMore) track('gallery_show_more', { gallery_type: clean(showMore.dataset.gallery, 30) });

    const tile = event.target.closest('.result-tile, .review-tile, [data-lightbox], [data-inside-media]');
    if (tile) {
      const type = tile.classList.contains('review-tile') ? 'review' : tile.classList.contains('result-tile') ? 'result' : 'inside';
      const media = tile.querySelector('img,video');
      track('gallery_item_open', {
        gallery_type: type,
        media_type: media?.tagName?.toLowerCase() || 'unknown',
        media_src: clean(media?.currentSrc || media?.src || media?.dataset?.src || tile.dataset.lightbox, 250)
      });
    }
  }, true);

  document.addEventListener('play', event => {
    if (event.target?.tagName === 'VIDEO') {
      track('video_play', { video_src: clean(event.target.currentSrc || event.target.src || event.target.dataset.src, 250) });
    }
  }, true);

  // Accurate engaged time when the user leaves or hides the page.
  const started = performance.now();
  let timeSent = false;
  function sendEngagedTime() {
    if (timeSent) return;
    timeSent = true;
    track('page_engaged_time', {
      engagement_seconds: Math.max(1, Math.round((performance.now() - started) / 1000)),
      transport_type: 'beacon'
    });
  }
  addEventListener('pagehide', sendEngagedTime, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendEngagedTime();
  });

  // Diagnostic event makes setup verification easier in GA4 Realtime/DebugView.
  track('analytics_ready', {
    analytics_version: 'gh-pro-1.0',
    measurement_id: MEASUREMENT_ID,
    traffic_source: lastTouch.source,
    traffic_medium: lastTouch.medium
  });
})();
