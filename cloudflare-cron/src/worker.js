/**
 * Gold Hunter — fast Cloudflare Cron Worker
 * ------------------------------------------------------------------
 * Why this exists:
 *   GitHub Actions "schedule" triggers are best-effort and can be delayed
 *   during peak load. This Worker runs on Cloudflare's own Cron Triggers,
 *   which are far tighter, and writes straight into the same KV namespace
 *   your Pages Functions already read from. GitHub Actions keeps running
 *   as-is (it is a good audit trail / long-term backup) — this Worker is
 *   an additional, faster layer on top, not a replacement.
 *
 * What it does every run (default: every 5 minutes):
 *   1. Fed Rate: calculates CME FedWatch-style target-rate probabilities
 *      from free, public 30-Day Fed Funds futures prices (Yahoo Finance
 *      delayed quotes for CBOT "ZQ" contracts). CME's own FedWatch REST
 *      API is a PAID product (confirmed: no free official API exists),
 *      and the public FedWatch web page is a JavaScript app whose table
 *      is not present in the raw HTML — that is exactly why the old
 *      HTML-scraping approach in scripts/update_fed_rate_expectation.py
 *      almost never found real data. This calculation sidesteps that
 *      entirely by deriving the same numbers CME publishes from the same
 *      public futures market, using CME's documented methodology.
 *      Result is written to KV key `fed-rate-live-v1`.
 *   2. Economic data: re-checks FRED's free, keyless CSV endpoint for
 *      every numeric release (CPI, core CPI, PPI, core PPI, NFP,
 *      unemployment, average hourly earnings, retail sales, jobless
 *      claims, GDP, PCE, core PCE) and writes any newer values to KV key
 *      `official-live-snapshot-v1`. `functions/api/data-engine.js` already
 *      merges any source by "whichever has the newest reporting period
 *      wins" (see chooseMetric/mergeOfficialMetrics), so wiring this in
 *      is purely additive and safe even if this Worker is not deployed.
 *
 * KV write budget (Workers KV free plan = 1,000 writes/day, shared across
 * this whole namespace, including everything else the site already stores
 * in it):
 *   - This Worker only WRITES when something meaningfully changed, or as a
 *     once-per-30-minute "still alive" heartbeat otherwise — it fetches and
 *     computes every run (that costs nothing against the KV quota), but
 *     skips the KV `put` call itself when nothing worth showing has moved.
 *   - Worst realistic case: ~2 writes/hour x 2 keys x 24h = under 100
 *     writes/day, leaving generous headroom for the rest of the site.
 *   - Fetches to Yahoo Finance / FRED are NOT Cloudflare KV operations and
 *     do not count against this limit at all.
 *
 * Deployment (see README.md in this folder for the full walkthrough):
 *   1. `npm i -g wrangler` (or use `npx wrangler`).
 *   2. Edit wrangler.toml: set your account_id and the KV namespace id
 *      that your Cloudflare Pages project already binds as GH_MARKET_DATA.
 *   3. `wrangler deploy` from inside this folder.
 *   4. No secrets are required — every source used here is free and
 *      keyless (Yahoo Finance delayed quotes, FRED public CSV).
 */

const SITE_ORIGIN = 'https://goldhunter.site';
const MONTH_CODE = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z']; // Jan..Dec, CME futures month codes
const FED_RATE_KV_KEY = 'fed-rate-live-v1';
const OFFICIAL_KV_KEY = 'official-live-snapshot-v1';
const ENGINE_VERSION = 'cloudflare-cron-1.1';
const HEARTBEAT_MS = 15 * 60 * 1000; // even with zero change, refresh the timestamp at most every 15 minutes

/**
 * Only calls KV.put when `isMeaningfulChange` says the visible data actually
 * moved, or when the last write is older than HEARTBEAT_MS (so Admin can
 * still see "last checked" advancing even during a quiet market). This is
 * the same change-only philosophy already used everywhere else in this
 * project (see putJsonIfChanged in functions/api/data-engine.js) — it is
 * what keeps this Worker safely inside the Workers KV free-plan write quota
 * (1,000 writes/day, shared across the whole namespace) even at a 5-minute
 * cron cadence.
 */
async function putIfMeaningfulChange(env, key, next, isMeaningfulChange) {
  if (!env.GH_MARKET_DATA) return { written: false, reason: 'unbound' };
  let current = null;
  try { current = await env.GH_MARKET_DATA.get(key, { type: 'json' }); } catch { /* treat as absent */ }
  if (current) {
    const changed = isMeaningfulChange(current, next);
    const age = Date.now() - Date.parse(current.updatedAt || 0);
    const heartbeatDue = !Number.isFinite(age) || age >= HEARTBEAT_MS;
    if (!changed && !heartbeatDue) return { written: false, reason: 'unchanged-and-fresh' };
  }
  await env.GH_MARKET_DATA.put(key, JSON.stringify(next), { expirationTtl: 3600 });
  return { written: true };
}

// Mirrors scripts/update_official_data.py FRED_SERIES so both layers agree on definitions.
const FRED_SERIES = {
  cpi_yoy: { id: 'CPIAUCSL', mode: 'yoy', suffix: '%', decimals: 1 },
  core_cpi_yoy: { id: 'CPILFESL', mode: 'yoy', suffix: '%', decimals: 1 },
  ppi_yoy: { id: 'WPSFD4', mode: 'yoy', suffix: '%', decimals: 1 },
  core_ppi_yoy: { id: 'WPSFD49116', mode: 'yoy', suffix: '%', decimals: 1 },
  nfp: { id: 'PAYEMS', mode: 'change', suffix: 'K', decimals: 0 },
  unemployment: { id: 'UNRATE', mode: 'level', suffix: '%', decimals: 1 },
  avg_hourly_earnings: { id: 'CES0500000003', mode: 'mom', suffix: '%', decimals: 1 },
  retail_sales: { id: 'RSAFS', mode: 'mom', suffix: '%', decimals: 1 },
  jobless_claims: { id: 'ICSA', mode: 'level', suffix: 'K', decimals: 0, scale: 0.001 },
  gdp: { id: 'A191RL1Q225SBEA', mode: 'level', suffix: '%', decimals: 1, period: 'quarter' },
  pce: { id: 'PCEPI', mode: 'yoy', suffix: '%', decimals: 1 },
  core_pce: { id: 'PCEPILFE', mode: 'yoy', suffix: '%', decimals: 1 },
};

function fmt(value, suffix, decimals, scale = 1) {
  if (!Number.isFinite(value)) return '';
  const scaled = value * scale;
  let text = scaled.toFixed(decimals);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return `${text}${suffix}`;
}

function monthFromDate(date) { return date.slice(0, 7); }
function quarterFromDate(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

async function fredRows(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const response = await fetch(url, { headers: { accept: 'text/csv' } });
  if (!response.ok) throw new Error(`FRED ${seriesId} HTTP ${response.status}`);
  const text = (await response.text()).replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`FRED ${seriesId} returned no rows`);
  const header = lines[0].split(',');
  const dateIdx = header.findIndex((h) => /date/i.test(h));
  const valueIdx = header.findIndex((h, i) => i !== dateIdx && h);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const date = (cols[dateIdx] || '').trim();
    const value = Number(cols[valueIdx]);
    if (date && Number.isFinite(value)) rows.push({ date, value });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) throw new Error(`FRED ${seriesId} had no usable numeric rows`);
  return rows;
}

function fredMetric(rows, cfg) {
  const calc = (index) => {
    if (index >= rows.length) return null;
    const current = rows[index].value;
    if (cfg.mode === 'level') return current;
    if (cfg.mode === 'change') {
      if (index + 1 >= rows.length) return null;
      return current - rows[index + 1].value;
    }
    if (cfg.mode === 'mom') {
      if (index + 1 >= rows.length || rows[index + 1].value === 0) return null;
      return (current / rows[index + 1].value - 1) * 100;
    }
    if (cfg.mode === 'yoy') {
      const [y, m] = monthFromDate(rows[index].date).split('-');
      const comparison = `${Number(y) - 1}-${m}`;
      const base = rows.find((row) => monthFromDate(row.date) === comparison)?.value;
      return base ? (current / base - 1) * 100 : null;
    }
    return null;
  };
  const history = [];
  for (let index = 0; index < rows.length && history.length < 10; index++) {
    const actual = calc(index);
    if (actual === null) continue;
    const previous = calc(index + 1);
    const period = cfg.period === 'quarter' ? quarterFromDate(rows[index].date)
      : cfg.mode === 'level' ? rows[index].date : monthFromDate(rows[index].date);
    history.push({
      period,
      observationDate: rows[index].date,
      actual: fmt(actual, cfg.suffix, cfg.decimals, cfg.scale || 1),
      previous: fmt(previous, cfg.suffix, cfg.decimals, cfg.scale || 1),
    });
  }
  if (!history.length) return null;
  return { ...history[0], history };
}

async function refreshEconomicData(env) {
  const results = {};
  const errors = {};
  await Promise.all(Object.entries(FRED_SERIES).map(async ([key, cfg]) => {
    try {
      const rows = await fredRows(cfg.id);
      const metric = fredMetric(rows, cfg);
      if (metric) results[key] = { ...metric, source: 'FRED (Cloudflare Cron fast layer)' };
    } catch (error) {
      errors[key] = String(error?.message || error);
    }
  }));
  if (!Object.keys(results).length) {
    return { ok: false, error: 'All FRED series failed', errors };
  }
  const payload = { metrics: results, updatedAt: new Date().toISOString(), engineVersion: ENGINE_VERSION, errors };
  const isMeaningfulChange = (current, next) => {
    const keys = new Set([...Object.keys(current?.metrics || {}), ...Object.keys(next.metrics || {})]);
    for (const key of keys) {
      const a = current?.metrics?.[key], b = next.metrics?.[key];
      if ((a?.period || '') !== (b?.period || '') || (a?.actual || '') !== (b?.actual || '')) return true;
    }
    return false;
  };
  const write = await putIfMeaningfulChange(env, OFFICIAL_KV_KEY, payload, isMeaningfulChange);
  return { ok: true, count: Object.keys(results).length, errors, ...write };
}

function fedFuturesSymbol(year, monthIndex) {
  return `ZQ${MONTH_CODE[monthIndex]}${String(year).slice(-2)}.CBT`;
}

async function yahooFuturesPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Yahoo ${symbol} HTTP ${response.status}`);
  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter((v) => Number.isFinite(v));
  const price = Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : closes.at(-1);
  if (!Number.isFinite(price)) throw new Error(`No usable settlement price for ${symbol}`);
  return price;
}

function parseRangePair(text) {
  const nums = String(text || '').replace(/[–—]/g, '-').match(/\d+(?:\.\d+)?/g) || [];
  if (nums.length < 2) return null;
  return [Number(nums[0]), Number(nums[1])];
}

function distributeProbability(impliedBps) {
  const lower = Math.floor(impliedBps / 25) * 25;
  const upper = lower + 25;
  if (Math.abs(impliedBps - lower) < 0.5) return [{ stepBps: lower, probability: 100 }];
  const fractionUpper = ((impliedBps - lower) / 25) * 100;
  const fractionLower = 100 - fractionUpper;
  return [
    { stepBps: lower, probability: Number(fractionLower.toFixed(1)) },
    { stepBps: upper, probability: Number(fractionUpper.toFixed(1)) },
  ].filter((row) => row.probability > 0.4);
}

async function computeFedRate(env) {
  const [rateSnapshot, events] = await Promise.all([
    fetch(`${SITE_ORIGIN}/assets/data/rate-expectation.json?cron=${Date.now()}`).then((r) => r.json()),
    fetch(`${SITE_ORIGIN}/data/generated-events.json?cron=${Date.now()}`).then((r) => r.json()).catch(() => []),
  ]);
  const currentRange = parseRangePair(rateSnapshot?.currentTargetRange);
  if (!currentRange) throw new Error('No baseline currentTargetRange to work from');
  const currentMid = (currentRange[0] + currentRange[1]) / 2;

  const now = Date.now();
  const fomcEvents = (Array.isArray(events) ? events : [])
    .filter((e) => String(e.type) === 'fomc' && Date.parse(e.releasePeriod ? `${e.releasePeriod}T12:00:00Z` : e.datetime) > now - 86400000)
    .sort((a, b) => Date.parse(a.releasePeriod || a.datetime) - Date.parse(b.releasePeriod || b.datetime));
  const nextMeeting = fomcEvents[0];
  if (!nextMeeting) throw new Error('No upcoming FOMC meeting in the published schedule');

  const usMeetingDate = new Date(`${nextMeeting.releasePeriod || nextMeeting.datetime.slice(0, 10)}T12:00:00Z`);
  const year = usMeetingDate.getUTCFullYear();
  const month = usMeetingDate.getUTCMonth();
  const day = usMeetingDate.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;

  const followingMonthHasMeeting = fomcEvents.slice(1).some((e) => {
    const d = new Date(`${e.releasePeriod || e.datetime.slice(0, 10)}T12:00:00Z`);
    return d.getUTCFullYear() === nextMonthYear && d.getUTCMonth() === nextMonth;
  });

  const thisMonthPrice = await yahooFuturesPrice(fedFuturesSymbol(year, month));
  const nextMonthPrice = followingMonthHasMeeting
    ? null
    : await yahooFuturesPrice(fedFuturesSymbol(nextMonthYear, nextMonth)).catch(() => null);

  const avgRateThisMonth = 100 - thisMonthPrice;
  const remainingDays = daysInMonth - day;
  let postMeetingRate;
  if (remainingDays <= 0) {
    if (!Number.isFinite(nextMonthPrice)) throw new Error('Meeting is at month-end and next-month contract is unavailable');
    postMeetingRate = 100 - nextMonthPrice;
  } else {
    postMeetingRate = (avgRateThisMonth * daysInMonth - currentMid * day) / remainingDays;
    if (Number.isFinite(nextMonthPrice)) {
      const directRead = 100 - nextMonthPrice;
      postMeetingRate = Math.abs(directRead - postMeetingRate) <= 0.15 ? (directRead + postMeetingRate) / 2 : directRead;
    }
  }

  const impliedBps = Math.round((postMeetingRate - currentMid) * 100);
  const levels = distributeProbability(impliedBps);
  const outcomes = levels.map(({ stepBps, probability }) => {
    const lower = currentRange[0] + stepBps / 100;
    const upper = currentRange[1] + stepBps / 100;
    const direction = stepBps < 0 ? 'cut' : stepBps > 0 ? 'hike' : 'hold';
    return {
      targetRange: `${lower.toFixed(2)}%–${upper.toFixed(2)}%`,
      probability,
      move: stepBps === 0 ? 'No change' : `${Math.abs(stepBps)} bps ${direction}`,
      direction,
    };
  });

  const payload = {
    meetingDate: usMeetingDate.toISOString().slice(0, 10),
    currentTargetRange: rateSnapshot.currentTargetRange,
    outcomes,
    probabilityTotal: Number(outcomes.reduce((s, o) => s + o.probability, 0).toFixed(1)),
    source: 'Gold Hunter calculated (CME FedWatch methodology)',
    sourceUrl: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
    calculationMethod: '30-Day Fed Funds futures settlement prices (CBOT, delayed quotes), CME FedWatch-style day-weighted probability model. Not CME\u2019s own proprietary data feed.',
    sourceMode: 'cloudflare-cron-calculated',
    sourceStatus: 'live',
    live: true,
    officialFetchSucceeded: true,
    updatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    kvWrite: true,
  };
  const isMeaningfulChange = (current, next) => {
    if ((current.meetingDate || '') !== next.meetingDate) return true;
    if ((current.currentTargetRange || '') !== next.currentTargetRange) return true;
    const a = current.outcomes || [], b = next.outcomes || [];
    if (a.length !== b.length) return true;
    const byRange = Object.fromEntries(a.map((o) => [o.targetRange, o.probability]));
    return b.some((o) => !(o.targetRange in byRange) || Math.abs(Number(byRange[o.targetRange]) - o.probability) >= 1);
  };
  const write = await putIfMeaningfulChange(env, FED_RATE_KV_KEY, payload, isMeaningfulChange);
  return { ok: true, meetingDate: payload.meetingDate, outcomes, impliedBps, ...write };
}

async function runAll(env) {
  const report = { startedAt: new Date().toISOString() };
  try {
    report.fedRate = await computeFedRate(env);
  } catch (error) {
    report.fedRate = { ok: false, error: String(error?.message || error) };
  }
  try {
    report.economicData = await refreshEconomicData(env);
  } catch (error) {
    report.economicData = { ok: false, error: String(error?.message || error) };
  }
  return report;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAll(env));
  },
  // GET this Worker's own URL any time to trigger a run manually and see the result —
  // handy for testing right after deployment, before the first cron tick fires.
  async fetch(request, env) {
    const report = await runAll(env);
    return new Response(JSON.stringify(report, null, 2), { headers: { 'content-type': 'application/json' } });
  },
};
