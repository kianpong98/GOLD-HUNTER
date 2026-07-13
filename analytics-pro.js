(function () {
  'use strict';

  var STORAGE_FIRST = 'gh_first_touch_v1';
  var STORAGE_LAST = 'gh_last_touch_v1';
  var SESSION_ID_KEY = 'gh_session_id_v1';
  var scrollSent = {};
  var sectionSeen = {};
  var pageStart = Date.now();

  function safeParse(value) {
    try { return JSON.parse(value || 'null'); } catch (_) { return null; }
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }

  function getSessionId() {
    var id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  function normalizeSource(raw) {
    var value = (raw || '').toLowerCase();
    if (!value) return '';
    if (value.indexOf('instagram') !== -1 || value === 'ig') return 'instagram';
    if (value.indexOf('facebook') !== -1 || value === 'fb') return 'facebook';
    if (value.indexOf('tiktok') !== -1) return 'tiktok';
    if (value.indexOf('xiaohongshu') !== -1 || value.indexOf('xhs') !== -1 || value.indexOf('rednote') !== -1) return 'xiaohongshu';
    if (value.indexOf('google') !== -1) return 'google';
    if (value.indexOf('bing') !== -1) return 'bing';
    if (value.indexOf('youtube') !== -1) return 'youtube';
    if (value.indexOf('whatsapp') !== -1) return 'whatsapp';
    return raw;
  }

  function detectTouch() {
    var params = new URLSearchParams(location.search);
    var source = normalizeSource(params.get('utm_source') || '');
    var medium = params.get('utm_medium') || '';
    var campaign = params.get('utm_campaign') || '';
    var content = params.get('utm_content') || '';
    var term = params.get('utm_term') || '';
    var referrer = document.referrer || '';

    if (!source && referrer) {
      try {
        var refHost = new URL(referrer).hostname.replace(/^www\./, '');
        if (refHost !== location.hostname.replace(/^www\./, '')) {
          source = normalizeSource(refHost);
          medium = /google|bing|yahoo|duckduckgo/.test(refHost) ? 'organic' : 'referral';
        }
      } catch (_) {}
    }

    if (!source) {
      source = 'direct';
      medium = medium || '(none)';
    }

    return {
      source: source,
      medium: medium || '(not set)',
      campaign: campaign || '(not set)',
      content: content || '(not set)',
      term: term || '(not set)',
      landing_page: location.pathname + location.search,
      referrer: referrer || '(direct)',
      captured_at: new Date().toISOString()
    };
  }

  var currentTouch = detectTouch();
  var firstTouch = safeParse(localStorage.getItem(STORAGE_FIRST));
  if (!firstTouch) {
    firstTouch = currentTouch;
    localStorage.setItem(STORAGE_FIRST, JSON.stringify(firstTouch));
  }
  localStorage.setItem(STORAGE_LAST, JSON.stringify(currentTouch));
  var lastTouch = currentTouch;

  function baseParams() {
    return {
      session_id: getSessionId(),
      page_path: location.pathname,
      page_title: document.title,
      first_source: firstTouch.source,
      first_medium: firstTouch.medium,
      first_campaign: firstTouch.campaign,
      last_source: lastTouch.source,
      last_medium: lastTouch.medium,
      last_campaign: lastTouch.campaign
    };
  }

  function send(eventName, params) {
    var payload = Object.assign(baseParams(), params || {});
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, payload));
    }
  }

  function textOf(el) {
    return ((el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 100);
  }

  function sectionFor(el) {
    var section = el.closest('section, header, footer, nav, main, article');
    if (!section) return 'unknown';
    return section.id || section.getAttribute('data-section') || section.className.toString().split(/\s+/)[0] || section.tagName.toLowerCase();
  }

  function whatsappType(href) {
    return /chat\.whatsapp\.com/i.test(href) ? 'group' : 'direct_message';
  }

  function buttonLocation(el) {
    if (el.classList.contains('floating-whatsapp')) return 'floating';
    if (el.classList.contains('nav-cta') || el.closest('nav, .nav-links')) return 'navbar';
    if (el.closest('footer')) return 'footer';
    if (el.closest('#framework, .package-card')) return 'membership';
    if (el.closest('header, .hero')) return 'hero';
    return sectionFor(el);
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link) return;
    var href = link.href || '';

    if (/wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com/i.test(href)) {
      send('whatsapp_click', {
        button_location: buttonLocation(link),
        whatsapp_type: whatsappType(href),
        page_section: sectionFor(link),
        button_text: textOf(link),
        link_domain: (function () { try { return new URL(href).hostname; } catch (_) { return ''; } })()
      });
      return;
    }

    if (/show more/i.test(textOf(link)) || link.matches('[data-show-more], .show-more')) {
      send('show_more', { page_section: sectionFor(link), button_text: textOf(link) });
    }

    if (link.closest('[data-gallery], .gallery, .results-grid, .reviews-grid') || /result|review/i.test(link.className)) {
      send('gallery_open', {
        gallery_type: /review/i.test(link.className + ' ' + href) ? 'review' : 'result',
        page_section: sectionFor(link),
        item_label: textOf(link) || href.split('/').pop()
      });
    }
  }, true);

  document.addEventListener('play', function (event) {
    var video = event.target;
    if (video && video.tagName === 'VIDEO') {
      send('video_play', {
        page_section: sectionFor(video),
        video_src: (video.currentSrc || video.src || '').split('/').pop()
      });
    }
  }, true);

  function trackScroll() {
    var doc = document.documentElement;
    var max = Math.max(doc.scrollHeight - window.innerHeight, 1);
    var pct = Math.round((window.scrollY / max) * 100);
    [25, 50, 75, 90, 100].forEach(function (threshold) {
      if (pct >= threshold && !scrollSent[threshold]) {
        scrollSent[threshold] = true;
        send('scroll_depth', { scroll_percent: threshold });
      }
    });
  }
  window.addEventListener('scroll', trackScroll, { passive: true });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.35) return;
        var el = entry.target;
        var id = el.id || el.getAttribute('data-section') || el.className.toString().split(/\s+/)[0];
        if (!id || sectionSeen[id]) return;
        sectionSeen[id] = true;
        send('section_view', { section_id: id, page_section: id });
      });
    }, { threshold: [0.35] });
    document.querySelectorAll('section[id], [data-section]').forEach(function (el) { observer.observe(el); });
  }

  function sendEngagement() {
    var seconds = Math.max(1, Math.round((Date.now() - pageStart) / 1000));
    send('page_engagement', { engagement_seconds: seconds });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendEngagement();
  });
  window.addEventListener('pagehide', sendEngagement);

  window.GHAnalytics = {
    send: send,
    firstTouch: firstTouch,
    lastTouch: lastTouch
  };
})();
