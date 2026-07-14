const STATIC_URL = '/assets/data/rate-expectation.json?v=11.0.2';
const CME_URL = 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html';
const CACHE_SECONDS = 300;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      ...extraHeaders,
    },
  });
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '–')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\u0025/g, '%')
    .replace(/\\u0025/g, '%')
    .replace(/\\u2013|\u2013/g, '–')
    .replace(/\\u2014|\u2014/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRange(value) {
  const nums = cleanText(value).match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length < 2) return '';
  const a = Number(nums[0]);
  const b = Number(nums[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b > 20 || a >= b) return '';
  return `${a.toFixed(2)}%–${b.toFixed(2)}%`;
}

function numberProbability(value) {
  const n = Number(String(value ?? '').replace('%', '').trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function midpoint(range) {
  const nums = String(range || '').match(/\d+(?:\.\d+)?/g) || [];
  return nums.length >= 2 ? (Number(nums[0]) + Number(nums[1])) / 2 : null;
}

function directionFor(targetRange, currentTargetRange) {
  const target = midpoint(targetRange);
  const current = midpoint(currentTargetRange);
  if (!Number.isFinite(target) || !Number.isFinite(current)) return 'hold';
  if (target < current - 0.01) return 'cut';
  if (target > current + 0.01) return 'hike';
  return 'hold';
}

function moveFor(targetRange, currentTargetRange) {
  const target = midpoint(targetRange);
  const current = midpoint(currentTargetRange);
  if (!Number.isFinite(target) || !Number.isFinite(current)) return 'Market-implied outcome';
  const bps = Math.round((target - current) * 100);
  if (bps === 0) return 'No change';
  return `${Math.abs(bps)} bps ${bps < 0 ? 'cut' : 'hike'}`;
}

function chooseCurrentRange(outcomes, fallbackRange) {
  if (normalizeRange(fallbackRange)) return normalizeRange(fallbackRange);
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);
  return sorted[0]?.targetRange || '';
}

function dedupeOutcomes(rows) {
  const best = new Map();
  for (const row of rows) {
    const targetRange = normalizeRange(row.targetRange || row.range || row.rateRange || row.label);
    const probability = numberProbability(row.probability ?? row.prob ?? row.value ?? row.percent ?? row.percentage);
    if (!targetRange || probability === null) continue;
    const prior = best.get(targetRange);
    if (!prior || probability > prior.probability) best.set(targetRange, { targetRange, probability });
  }
  const values = [...best.values()].filter(x => x.probability > 0.001).sort((a, b) => a.targetRange.localeCompare(b.targetRange));
  const total = values.reduce((sum, x) => sum + x.probability, 0);
  if (!values.length || total < 80 || total > 120) return [];
  return values.map(x => ({ ...x, probability: x.probability * 100 / total }));
}

function collectFromObject(root) {
  const rows = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (depth > 16 || value == null) return;
    if (typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      if (!Array.isArray(value)) {
        const keys = Object.keys(value);
        let rangeValue = '';
        let probabilityValue = null;
        for (const key of keys) {
          if (/target.*range|rate.*range|targetrate|target_rate|range/i.test(key)) rangeValue ||= value[key];
          if (/probability|probabilityvalue|prob|percentage|percent/i.test(key)) probabilityValue ??= value[key];
        }
        if (rangeValue !== '' && probabilityValue !== null) rows.push({ targetRange: rangeValue, probability: probabilityValue });
      }
      for (const child of Object.values(value)) visit(child, depth + 1);
    }
  };
  visit(root);
  return rows;
}

function parseJsonCandidates(html) {
  const candidates = [];
  const scriptRegex = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) candidates.push(match[1]);
  const markers = ['__NEXT_DATA__', '__INITIAL_STATE__', 'fedWatch', 'fedwatch', 'probability'];
  for (const marker of markers) {
    let from = 0;
    while ((from = html.indexOf(marker, from)) !== -1) {
      const start = html.lastIndexOf('{', from);
      if (start >= 0) {
        let level = 0, inString = false, escaped = false;
        for (let i = start; i < Math.min(html.length, start + 800000); i++) {
          const ch = html[i];
          if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
          } else {
            if (ch === '"') inString = true;
            else if (ch === '{') level++;
            else if (ch === '}') {
              level--;
              if (level === 0) { candidates.push(html.slice(start, i + 1)); break; }
            }
          }
        }
      }
      from += marker.length;
    }
  }
  return candidates;
}

function parseCmeHtml(html) {
  const rows = [];
  for (const raw of parseJsonCandidates(html)) {
    try { rows.push(...collectFromObject(JSON.parse(raw))); } catch {}
  }

  // Generic fallback for JSON-like or rendered table content where range and probability are close together.
  const text = cleanText(html);
  const pairPatterns = [
    /(\d+(?:\.\d+)?\s*%?\s*[–-]\s*\d+(?:\.\d+)?\s*%?)[^\d%]{0,160}(\d+(?:\.\d+)?)\s*%/g,
    /(?:targetRate|target_range|targetRange|rateRange)["'\s:=]+([^,"'}<]{3,40})[\s\S]{0,220}?(?:probability|percentage|percent|prob)["'\s:=]+(\d+(?:\.\d+)?)/gi,
  ];
  for (const regex of pairPatterns) {
    let match;
    while ((match = regex.exec(text))) rows.push({ targetRange: match[1], probability: match[2] });
  }

  const outcomes = dedupeOutcomes(rows);
  if (!outcomes.length) throw new Error('CME page loaded but rate probabilities could not be parsed');

  let currentTargetRange = '';
  const currentMatch = text.match(/current\s+(?:federal\s+funds\s+)?target\s+rate[^\d]{0,80}(\d+(?:\.\d+)?\s*%?\s*[–-]\s*\d+(?:\.\d+)?\s*%?)/i);
  if (currentMatch) currentTargetRange = normalizeRange(currentMatch[1]);

  let meetingDate = '';
  const meetingMatch = text.match(/(?:next\s+FOMC|FOMC\s+meeting)[^\d]{0,100}(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+20\d{2})/i);
  if (meetingMatch) {
    const parsed = new Date(meetingMatch[1]);
    if (!Number.isNaN(parsed.getTime())) meetingDate = parsed.toISOString().slice(0, 10);
  }

  return { outcomes, currentTargetRange, meetingDate };
}

async function loadStatic(origin) {
  const response = await fetch(new URL(STATIC_URL, origin), {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`static expectation ${response.status}`);
  return response.json();
}

async function fetchOfficial() {
  const response = await fetch(CME_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (compatible; GoldHunterMarketData/1.0; +https://goldhunter.site)',
    },
    redirect: 'follow',
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`CME FedWatch HTTP ${response.status}`);
  const html = await response.text();
  if (html.length < 1000) throw new Error('CME FedWatch returned an incomplete page');
  return parseCmeHtml(html);
}

export async function onRequestGet({ request }) {
  const checkedAt = new Date().toISOString();
  const origin = new URL(request.url).origin;
  let fallback;
  try { fallback = await loadStatic(origin); } catch { fallback = null; }

  try {
    const official = await fetchOfficial();
    const currentTargetRange = chooseCurrentRange(official.outcomes, official.currentTargetRange || fallback?.currentTargetRange);
    const outcomes = official.outcomes
      .map(x => ({
        targetRange: x.targetRange,
        probability: Number(x.probability.toFixed(2)),
        direction: directionFor(x.targetRange, currentTargetRange),
        move: moveFor(x.targetRange, currentTargetRange),
      }))
      .sort((a, b) => b.probability - a.probability);
    const meetingDate = official.meetingDate || fallback?.meetingDate || '';
    const meetingDateTime = fallback?.meetingDateTime || (meetingDate ? `${meetingDate}T02:00:00+08:00` : '');
    return json({
      ...(fallback || {}),
      meetingDate,
      meetingDateTime,
      currentTargetRange,
      outcomes,
      updatedAt: checkedAt,
      lastCheckedAt: checkedAt,
      live: true,
      sourceStatus: 'live',
      source: 'CME FedWatch',
      sourceUrl: CME_URL,
      cacheMode: `Cloudflare edge cache ${CACHE_SECONDS}s; no KV writes`,
      kvWrite: false,
      engineVersion: '11.0.2-fedwatch-live-no-kv',
    });
  } catch (error) {
    if (!fallback) return json({ error: 'Rate expectation unavailable', detail: String(error?.message || error), lastCheckedAt: checkedAt, live: false, kvWrite: false }, 503);
    return json({
      ...fallback,
      lastCheckedAt: checkedAt,
      live: false,
      sourceStatus: 'fallback',
      sourceError: String(error?.message || error),
      source: 'CME FedWatch cached snapshot',
      sourceUrl: CME_URL,
      cacheMode: 'Static fallback; no KV writes',
      kvWrite: false,
      engineVersion: '11.0.2-fedwatch-live-no-kv',
    }, 200, { 'x-gh-data-status': 'fallback' });
  }
}
