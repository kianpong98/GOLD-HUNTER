const STATIC_URL = '/assets/data/rate-expectation.json?v=fed-futures-calculated-2.3-cme-method-no-kv';
const ENGINE_VERSION = 'fed-futures-calculated-2.3-cme-method-no-kv';

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=900',
  'access-control-allow-origin': '*',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

function valid(data) {
  if (!data || !Array.isArray(data.outcomes) || data.outcomes.length < 2) return false;
  if (!data.meetingDate || !data.currentTargetRange) return false;
  const total = data.outcomes.reduce((sum, row) => sum + Number(row?.probability || 0), 0);
  return data.outcomes.every(row => row?.targetRange && Number.isFinite(Number(row?.probability)))
    && total >= 98.5 && total <= 101.5;
}

export async function onRequestGet({ request }) {
  const lastApiCheckedAt = new Date().toISOString();
  try {
    const url = new URL(STATIC_URL, new URL(request.url).origin);
    url.searchParams.set('_', String(Math.floor(Date.now() / 180000)));
    const response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 180, cacheEverything: true },
    });
    if (!response.ok) throw new Error(`Rate snapshot HTTP ${response.status}`);
    const data = await response.json();
    if (!valid(data)) throw new Error('Rate snapshot failed validation');

    const checked = Date.parse(data.lastCheckedAt || data.updatedAt || 0);
    const ageMinutes = Number.isFinite(checked) ? Math.round((Date.now() - checked) / 60000) : null;
    const calculationSucceeded = data.calculationSucceeded === true || data.sourceMode === 'free-futures-calculation';
    let sourceStatus = calculationSucceeded
      ? (ageMinutes === null ? 'cached' : ageMinutes <= 180 ? 'live' : ageMinutes <= 1440 ? 'cached' : 'stale')
      : (ageMinutes !== null && ageMinutes > 1440 ? 'stale' : 'cached');

    return json({
      ...data,
      engineVersion: ENGINE_VERSION,
      sourceStatus,
      live: calculationSucceeded && sourceStatus === 'live',
      calculationSucceeded,
      lastApiCheckedAt,
      sourceAgeMinutes: ageMinutes,
      cacheMode: 'GitHub Actions futures calculation; read-only Cloudflare edge cache',
      kvWrite: false,
    });
  } catch (error) {
    return json({
      engineVersion: ENGINE_VERSION,
      meetingDate: null,
      currentTargetRange: null,
      outcomes: [],
      source: '30-Day Fed Funds futures implied estimate',
      sourceUrl: 'https://www.cmegroup.com/markets/interest-rates/stirs/30-day-federal-fund.html',
      sourceStatus: 'offline',
      live: false,
      calculationSucceeded: false,
      lastApiCheckedAt,
      kvWrite: false,
      error: String(error?.message || error),
    }, 503);
  }
}
