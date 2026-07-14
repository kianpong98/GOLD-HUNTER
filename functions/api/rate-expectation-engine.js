const STATIC_URL = '/assets/data/rate-expectation.json?v=11.0.4-fed-ui-sync';
const CME_PAGE_URL = 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html';
const CME_API_BASE = 'https://markets.api.cmegroup.com/fedwatch/v1';
const EDGE_REFRESH_SECONDS = 300;
const LAST_GOOD_SECONDS = 86400;
const ENGINE_VERSION = '11.0.4-fedwatch-exact-ui-sync-no-kv';

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
    .replace(/\u0025|\\u0025/g, '%')
    .replace(/\u2013|\\u2013|\u2014|\\u2014/g, '–')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRange(value) {
  const nums = cleanText(value).match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length < 2) return null;
  let lower = Number(nums[0]);
  let upper = Number(nums[1]);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) return null;

  // CME charts commonly label target ranges in basis points, e.g. 350–375.
  if (upper > 20) {
    if (lower < 0 || upper > 2000) return null;
    lower /= 100;
    upper /= 100;
  }
  if (lower < 0 || upper > 20 || lower >= upper) return null;

  const lowerBps = Math.round(lower * 100);
  const upperBps = Math.round(upper * 100);
  if (upperBps - lowerBps < 1 || upperBps - lowerBps > 100) return null;
  return {
    lower,
    upper,
    lowerBps,
    upperBps,
    key: `${lowerBps}-${upperBps}`,
    display: `${lower.toFixed(2)}%–${upper.toFixed(2)}%`,
  };
}

function normalizeRange(value) {
  return parseRange(value)?.display || '';
}

function numberProbability(value) {
  const n = Number(String(value ?? '').replace('%', '').trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function midpoint(range) {
  const parsed = parseRange(range);
  return parsed ? (parsed.lower + parsed.upper) / 2 : null;
}

function directionFor(targetRange, currentTargetRange) {
  const target = midpoint(targetRange);
  const current = midpoint(currentTargetRange);
  if (!Number.isFinite(target) || !Number.isFinite(current)) return 'hold';
  if (target < current - 0.001) return 'cut';
  if (target > current + 0.001) return 'hike';
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

function toIsoDate(value) {
  if (!value) return '';
  const text = cleanText(value);
  const direct = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (direct) return `${direct[1]}-${String(direct[2]).padStart(2, '0')}-${String(direct[3]).padStart(2, '0')}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function exactOutcomes(rows, currentTargetRange = '') {
  const byRange = new Map();
  for (const row of rows || []) {
    const range = parseRange(row.targetRange ?? row.range ?? row.rateRange ?? row.label ?? row.targetRate);
    const probability = numberProbability(row.probability ?? row.prob ?? row.value ?? row.percent ?? row.percentage ?? row.currentProbability);
    if (!range || probability === null) continue;
    const prior = byRange.get(range.key);
    // Keep the last explicit value; do not normalize or recalculate official probabilities.
    byRange.set(range.key, { targetRange: range.display, probability, lowerBps: range.lowerBps, upperBps: range.upperBps, prior });
  }

  const all = [...byRange.values()].sort((a, b) => a.lowerBps - b.lowerBps);
  if (!all.length) return [];

  // Select the most coherent contiguous 25bp/50bp block whose official values total ~100%.
  const current = parseRange(currentTargetRange);
  let best = null;
  for (let start = 0; start < all.length; start++) {
    let sum = 0;
    for (let end = start; end < Math.min(all.length, start + 8); end++) {
      if (end > start && all[end].lowerBps !== all[end - 1].upperBps) break;
      sum += all[end].probability;
      const group = all.slice(start, end + 1);
      const totalError = Math.abs(100 - sum);
      const includesCurrent = current ? group.some(x => x.lowerBps === current.lowerBps && x.upperBps === current.upperBps) : false;
      const score = totalError + (includesCurrent ? 0 : 8) + (group.length < 2 ? 20 : 0);
      if (sum >= 98.5 && sum <= 101.5 && (!best || score < best.score)) best = { score, group, sum };
    }
  }
  if (!best) return [];
  return best.group.map(({ targetRange, probability }) => ({ targetRange, probability }));
}

function findRowsInObject(root) {
  const rows = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (depth > 18 || value == null) return;
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (!Array.isArray(value)) {
      const keys = Object.keys(value);
      let rangeValue = '';
      let probabilityValue = null;
      for (const key of keys) {
        if (/target.*range|rate.*range|targetrate|target_rate|targetRate|range/i.test(key)) rangeValue ||= value[key];
        if (/probability|probabilityvalue|currentProbability|prob|percentage|percent/i.test(key)) probabilityValue ??= value[key];
      }
      if (rangeValue !== '' && probabilityValue !== null) rows.push({ targetRange: rangeValue, probability: probabilityValue });
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(root);
  return rows;
}

function jsonCandidates(html) {
  const candidates = [];
  const scriptRegex = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) candidates.push(match[1]);
  return candidates;
}

function parsePublicCmePage(html) {
  const rawText = cleanText(html);
  const currentMatch = rawText.match(/current\s+(?:federal\s+funds\s+)?target\s+rate\s+is\s+(\d+(?:\.\d+)?\s*%?\s*[–-]\s*\d+(?:\.\d+)?\s*%?)/i);
  const currentTargetRange = normalizeRange(currentMatch?.[1] || '');

  const titleMatch = rawText.match(/Target\s+Rate\s+Probabilities\s+for\s+(.{3,40}?)\s+Fed\s+Meeting/i);
  const meetingDate = toIsoDate(titleMatch?.[1] || '');

  const rows = [];
  for (const candidate of jsonCandidates(html)) {
    try { rows.push(...findRowsInObject(JSON.parse(candidate))); } catch {}
  }

  // Exact visible/table format: 350–375 ... 54.6%
  const exactPair = /(\d{2,4}(?:\.\d+)?\s*[–-]\s*\d{2,4}(?:\.\d+)?)[^\d%]{0,120}(\d{1,3}(?:\.\d+)?)\s*%/g;
  let pair;
  while ((pair = exactPair.exec(rawText))) rows.push({ targetRange: pair[1], probability: pair[2] });

  const outcomes = exactOutcomes(rows, currentTargetRange);
  if (!currentTargetRange) throw new Error('CME current target range could not be verified');
  if (!outcomes.length) throw new Error('CME target-rate probability table could not be verified');
  return { outcomes, currentTargetRange, meetingDate };
}

function parseOfficialApi(payload) {
  const candidates = Array.isArray(payload) ? payload : [payload];
  const rows = findRowsInObject(payload);
  const text = JSON.stringify(payload);
  const currentMatch = text.match(/(?:currentTargetRate|current_target_rate|currentRateRange|currentRange)["']?\s*[:=]\s*["']([^"']+)/i);
  const currentTargetRange = normalizeRange(currentMatch?.[1] || '');

  let meetingDate = '';
  for (const item of candidates) {
    meetingDate ||= toIsoDate(item?.meetingDt || item?.meetingDate || item?.fomcMeetingDate || item?.meeting_date);
  }
  if (!meetingDate) {
    const dateMatch = text.match(/(?:meetingDt|meetingDate|fomcMeetingDate|meeting_date)["']?\s*:\s*["']([^"']+)/i);
    meetingDate = toIsoDate(dateMatch?.[1] || '');
  }

  const outcomes = exactOutcomes(rows, currentTargetRange);
  if (!outcomes.length) throw new Error('CME API returned no verified probability table');
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

async function fetchOfficialApi(env) {
  const token = env?.CME_FEDWATCH_ACCESS_TOKEN;
  if (!token) return null;
  const response = await fetch(`${CME_API_BASE}/forecasts`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    cf: { cacheTtl: EDGE_REFRESH_SECONDS, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`CME FedWatch API HTTP ${response.status}`);
  return parseOfficialApi(await response.json());
}

async function fetchPublicCme() {
  const response = await fetch(CME_PAGE_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (compatible; GoldHunterMarketData/1.1; +https://goldhunter.site)',
    },
    redirect: 'follow',
    cf: { cacheTtl: EDGE_REFRESH_SECONDS, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`CME FedWatch page HTTP ${response.status}`);
  const html = await response.text();
  if (html.length < 1000) throw new Error('CME FedWatch returned an incomplete page');
  return parsePublicCmePage(html);
}

function buildResult(official, fallback, checkedAt, sourceMode) {
  const currentTargetRange = normalizeRange(official.currentTargetRange || fallback?.currentTargetRange);
  if (!currentTargetRange) throw new Error('Current target range is unavailable');
  const outcomes = official.outcomes
    .map(x => ({
      targetRange: normalizeRange(x.targetRange),
      probability: Number(Number(x.probability).toFixed(1)),
    }))
    .filter(x => x.targetRange && Number.isFinite(x.probability))
    .map(x => ({
      ...x,
      direction: directionFor(x.targetRange, currentTargetRange),
      move: moveFor(x.targetRange, currentTargetRange),
    }))
    .sort((a, b) => b.probability - a.probability);

  const total = Number(outcomes.reduce((sum, x) => sum + x.probability, 0).toFixed(1));
  if (!outcomes.length || total < 98.5 || total > 101.5) throw new Error(`Probability total failed verification (${total}%)`);

  const meetingDate = official.meetingDate || fallback?.meetingDate || '';
  const meetingDateTime = fallback?.meetingDateTime || (meetingDate ? `${meetingDate}T14:00:00-04:00` : '');
  return {
    ...(fallback || {}),
    meetingDate,
    meetingDateTime,
    currentTargetRange,
    outcomes,
    updatedAt: checkedAt,
    sourceUpdatedAt: checkedAt,
    lastCheckedAt: checkedAt,
    live: true,
    sourceStatus: 'live',
    sourceMode,
    source: 'CME FedWatch',
    sourceUrl: CME_PAGE_URL,
    probabilityTotal: total,
    exactOfficialValues: true,
    cacheMode: `Official CME data; Cloudflare edge/last-good cache; no KV writes`,
    kvWrite: false,
    engineVersion: ENGINE_VERSION,
  };
}

async function readLastGood(request) {
  try {
    const cache = caches.default;
    const key = new Request(`${new URL(request.url).origin}/__cache/fedwatch-last-good-11-0-4`, { method: 'GET' });
    const hit = await cache.match(key);
    return hit ? await hit.json() : null;
  } catch { return null; }
}

async function storeLastGood(request, data, context) {
  try {
    const cache = caches.default;
    const key = new Request(`${new URL(request.url).origin}/__cache/fedwatch-last-good-11-0-4`, { method: 'GET' });
    const response = new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${LAST_GOOD_SECONDS}`,
      },
    });
    const task = cache.put(key, response);
    if (context?.waitUntil) context.waitUntil(task); else await task;
  } catch {}
}

export async function onRequestGet({ request, env, context }) {
  const checkedAt = new Date().toISOString();
  const origin = new URL(request.url).origin;
  let fallback = null;
  try { fallback = await loadStatic(origin); } catch {}

  const errors = [];
  try {
    const apiResult = await fetchOfficialApi(env);
    const official = apiResult || await fetchPublicCme();
    const result = buildResult(official, fallback, checkedAt, apiResult ? 'official-api' : 'official-public-page');
    await storeLastGood(request, result, context);
    return json(result, 200, { 'x-gh-data-status': 'live', 'x-gh-fedwatch-source': result.sourceMode });
  } catch (error) {
    errors.push(String(error?.message || error));
  }

  const lastGood = await readLastGood(request);
  if (lastGood?.outcomes?.length) {
    return json({
      ...lastGood,
      lastCheckedAt: checkedAt,
      live: false,
      sourceStatus: 'cached-last-good',
      sourceError: errors.join(' | '),
      cacheMode: 'Last verified CME result from Cloudflare Cache API; no KV writes',
      kvWrite: false,
      engineVersion: ENGINE_VERSION,
    }, 200, { 'x-gh-data-status': 'cached-last-good' });
  }

  if (fallback?.outcomes?.length) {
    return json({
      ...fallback,
      lastCheckedAt: checkedAt,
      live: false,
      sourceStatus: 'static-fallback',
      sourceError: errors.join(' | '),
      source: 'CME FedWatch verified static snapshot',
      sourceUrl: CME_PAGE_URL,
      exactOfficialValues: true,
      cacheMode: 'Verified static fallback; no KV writes',
      kvWrite: false,
      engineVersion: ENGINE_VERSION,
    }, 200, { 'x-gh-data-status': 'static-fallback' });
  }

  return json({
    error: 'Rate expectation unavailable',
    detail: errors.join(' | '),
    lastCheckedAt: checkedAt,
    live: false,
    kvWrite: false,
    engineVersion: ENGINE_VERSION,
  }, 503);
}
