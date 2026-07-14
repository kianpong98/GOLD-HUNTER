const STATIC_URL = '/assets/data/rate-expectation.json';
const MANUAL_KEY = 'fed-rate-manual-override-v1';
const ENGINE_VERSION = 'fedwatch-official-first-manual-fallback-3.0';

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

function authorized(request, env) {
  const supplied = request.headers.get('x-admin-pin') || '';
  return Boolean(env.ADMIN_PIN && supplied && supplied === env.ADMIN_PIN);
}

function clean(value) {
  return String(value ?? '').trim();
}

function parseRange(value) {
  const nums = clean(value).replace(/[–—]/g, '-').match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length < 2) return null;
  let lower = Number(nums[0]);
  let upper = Number(nums[1]);
  if (upper > 20) {
    lower /= 100;
    upper /= 100;
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper > 20 || lower >= upper) return null;
  const lowerBps = Math.round(lower * 100);
  const upperBps = Math.round(upper * 100);
  if (![25, 50].includes(upperBps - lowerBps)) return null;
  return {
    lower,
    upper,
    lowerBps,
    upperBps,
    display: `${lower.toFixed(2)}%–${upper.toFixed(2)}%`,
  };
}

function midpoint(value) {
  const range = parseRange(value);
  return range ? (range.lower + range.upper) / 2 : null;
}

function normalizeOutcome(row, currentTargetRange) {
  const parsed = parseRange(row?.targetRange);
  const probability = Number(String(row?.probability ?? '').replace('%', '').trim());
  if (!parsed || !Number.isFinite(probability) || probability < 0 || probability > 100) return null;
  const targetMid = (parsed.lower + parsed.upper) / 2;
  const currentMid = midpoint(currentTargetRange);
  const bps = Number.isFinite(currentMid) ? Math.round((targetMid - currentMid) * 100) : 0;
  const direction = bps < 0 ? 'cut' : bps > 0 ? 'hike' : 'hold';
  return {
    targetRange: parsed.display,
    probability: Number(probability.toFixed(1)),
    move: bps === 0 ? 'No change' : `${Math.abs(bps)} bps ${direction}`,
    direction,
  };
}

function validatePayload(input) {
  const current = parseRange(input?.currentTargetRange);
  if (!current) throw new Error('Current target range is invalid. Example: 3.50%–3.75%.');
  const outcomes = (Array.isArray(input?.outcomes) ? input.outcomes : [])
    .map(row => normalizeOutcome(row, current.display))
    .filter(Boolean)
    .sort((a, b) => (parseRange(a.targetRange)?.lowerBps || 0) - (parseRange(b.targetRange)?.lowerBps || 0));
  if (outcomes.length < 2) throw new Error('At least two valid target-rate outcomes are required.');
  const total = Number(outcomes.reduce((sum, row) => sum + row.probability, 0).toFixed(1));
  if (total < 99.5 || total > 100.5) throw new Error(`Probabilities must total 100%. Current total: ${total}%.`);
  for (let i = 1; i < outcomes.length; i++) {
    const previous = parseRange(outcomes[i - 1].targetRange);
    const currentRow = parseRange(outcomes[i].targetRange);
    if (!previous || !currentRow || previous.upperBps !== currentRow.lowerBps) {
      throw new Error('Target-rate ranges must be continuous.');
    }
  }
  const meetingDate = /^20\d{2}-\d{2}-\d{2}$/.test(clean(input?.meetingDate)) ? clean(input.meetingDate) : '';
  if (!meetingDate) throw new Error('Meeting date is required in YYYY-MM-DD format.');
  return {
    meetingDate,
    meetingLabel: 'Next FOMC decision',
    currentTargetRange: current.display,
    outcomes,
    probabilityTotal: total,
  };
}

async function loadStatic(origin) {
  const response = await fetch(new URL(`${STATIC_URL}?v=${Date.now()}`, origin), {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`Static Fed snapshot HTTP ${response.status}`);
  return response.json();
}

async function loadManual(env) {
  if (!env.GH_MARKET_DATA) return null;
  try {
    return await env.GH_MARKET_DATA.get(MANUAL_KEY, { type: 'json' });
  } catch {
    return null;
  }
}

function isOfficialLive(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.outcomes)) return false;
  return snapshot.officialFetchSucceeded === true && snapshot.sourceMode === 'official-github-sync';
}

function buildManualResult(manual, snapshot, checkedAt) {
  return {
    ...manual,
    updatedAt: manual.updatedAt,
    lastCheckedAt: snapshot?.lastCheckedAt || checkedAt,
    officialDataChangedAt: manual.updatedAt,
    source: 'Admin manual Fed rate probabilities',
    sourceUrl: snapshot?.sourceUrl || 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
    sourceMode: 'manual-admin-fallback',
    sourceStatus: 'manual',
    live: false,
    exactOfficialValues: false,
    officialFetchSucceeded: false,
    cmeLastCheckedAt: snapshot?.lastCheckedAt || null,
    cmeLastError: snapshot?.lastOfficialFetchError || snapshot?.errors?.join?.(' | ') || '',
    cacheMode: 'CME is checked by GitHub Actions. Manual Admin data is used only while the official CME check is unavailable.',
    kvWrite: false,
    engineVersion: ENGINE_VERSION,
    manualOverrideAvailable: true,
  };
}

function buildOfficialResult(snapshot, checkedAt) {
  return {
    ...snapshot,
    lastApiCheckedAt: checkedAt,
    sourceStatus: 'live',
    sourceMode: 'official-github-sync',
    live: true,
    exactOfficialValues: true,
    cacheMode: 'Official CME GitHub snapshot is primary. Admin manual data is retained but not shown while CME is connected.',
    kvWrite: false,
    engineVersion: ENGINE_VERSION,
    manualOverrideAvailable: true,
  };
}

function buildStaticFallback(snapshot, checkedAt) {
  return {
    ...snapshot,
    lastApiCheckedAt: checkedAt,
    sourceStatus: 'verified-static-fallback',
    sourceMode: 'verified-static-fallback',
    live: false,
    exactOfficialValues: Boolean(snapshot?.exactOfficialValues),
    cacheMode: 'No live CME result and no Admin manual value. Using the last verified static snapshot.',
    kvWrite: false,
    engineVersion: ENGINE_VERSION,
    manualOverrideAvailable: true,
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-pin',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const checkedAt = new Date().toISOString();
  const origin = new URL(request.url).origin;
  let snapshot = null;
  let staticError = '';
  try {
    snapshot = await loadStatic(origin);
  } catch (error) {
    staticError = String(error?.message || error);
  }
  const manual = await loadManual(env);

  let result;
  if (isOfficialLive(snapshot)) {
    result = buildOfficialResult(snapshot, checkedAt);
  } else if (manual?.outcomes?.length) {
    result = buildManualResult(manual, snapshot, checkedAt);
  } else if (snapshot?.outcomes?.length) {
    result = buildStaticFallback(snapshot, checkedAt);
  } else {
    return json({
      error: 'Fed rate expectation is unavailable.',
      detail: staticError,
      lastApiCheckedAt: checkedAt,
      live: false,
      kvWrite: false,
      engineVersion: ENGINE_VERSION,
    }, 503);
  }

  if (authorized(request, env)) {
    result.admin = {
      manualOverride: manual || null,
      officialSnapshot: snapshot || null,
      effectiveSource: result.sourceMode,
    };
  }
  return json(result, 200, { 'x-gh-fed-source': result.sourceMode });
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ error: 'Incorrect PIN, or ADMIN_PIN is not configured.' }, 401);
  if (!env.GH_MARKET_DATA) return json({ error: 'GH_MARKET_DATA KV binding is not configured.' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  let validated;
  try {
    validated = validatePayload(body);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 400);
  }

  const now = new Date().toISOString();
  const payload = {
    ...validated,
    updatedAt: now,
    source: 'Admin manual Fed rate probabilities',
    sourceMode: 'manual-admin-fallback',
    sourceStatus: 'manual',
    live: false,
    exactOfficialValues: false,
    kvWrite: true,
    engineVersion: ENGINE_VERSION,
  };

  const existing = await loadManual(env);
  const comparable = value => JSON.stringify({
    meetingDate: value?.meetingDate,
    currentTargetRange: value?.currentTargetRange,
    outcomes: value?.outcomes,
  });
  if (existing && comparable(existing) === comparable(payload)) {
    return json({ ok: true, unchanged: true, version: ENGINE_VERSION, manualOverride: existing });
  }

  try {
    await env.GH_MARKET_DATA.put(MANUAL_KEY, JSON.stringify(payload));
    const verify = await env.GH_MARKET_DATA.get(MANUAL_KEY, { type: 'json' });
    if (!verify || comparable(verify) !== comparable(payload)) throw new Error('KV readback verification failed.');
    return json({ ok: true, unchanged: false, version: ENGINE_VERSION, manualOverride: verify });
  } catch (error) {
    return json({
      error: 'Manual Fed rate save failed.',
      detail: String(error?.message || error),
      version: ENGINE_VERSION,
    }, 500);
  }
}
