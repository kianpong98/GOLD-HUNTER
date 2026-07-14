const STATIC_URL = '/assets/data/rate-expectation.json?v=fedwatch-github-sync-1.3-status-safe';
const ENGINE_VERSION = 'fedwatch-github-sync-1.3-status-safe';

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
  const lastCheckedAt = new Date().toISOString();
  try {
    const url = new URL(STATIC_URL, new URL(request.url).origin);
    url.searchParams.set('_', String(Math.floor(Date.now() / 180000)));
    const response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 180, cacheEverything: true },
    });
    if (!response.ok) throw new Error(`FedWatch static HTTP ${response.status}`);
    const data = await response.json();
    if (!valid(data)) throw new Error('FedWatch static snapshot failed validation');

    const sourceChecked = Date.parse(data.lastCheckedAt || data.updatedAt || 0);
    const ageMinutes = Number.isFinite(sourceChecked) ? Math.round((Date.now() - sourceChecked) / 60000) : null;
    const officialFetchSucceeded = data.officialFetchSucceeded === true || data.sourceMode === 'official-github-sync';
    const githubChecked = data.githubChecked === true || ['official-github-sync', 'github-verified-fallback'].includes(data.sourceMode);
    const githubSynced = data.githubSynced === true || githubChecked;
    let sourceStatus = 'awaiting-sync';
    if (officialFetchSucceeded) {
      sourceStatus = ageMinutes === null ? 'cached' : ageMinutes <= 180 ? 'live' : ageMinutes <= 1440 ? 'cached' : 'stale';
    } else if (githubChecked) {
      sourceStatus = ageMinutes !== null && ageMinutes > 1440 ? 'stale' : 'cached';
    }
    return json({
      ...data,
      engineVersion: ENGINE_VERSION,
      sourceStatus,
      live: officialFetchSucceeded && sourceStatus === 'live',
      githubChecked,
      githubSynced,
      officialFetchSucceeded,
      lastApiCheckedAt: lastCheckedAt,
      sourceAgeMinutes: ageMinutes,
      cacheMode: 'GitHub Actions verified CME snapshot; read-only Cloudflare edge cache',
      kvWrite: false,
    });
  } catch (error) {
    return json({
      engineVersion: ENGINE_VERSION,
      meetingDate: null,
      currentTargetRange: null,
      outcomes: [],
      source: 'CME FedWatch',
      sourceUrl: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
      sourceStatus: 'offline',
      live: false,
      lastApiCheckedAt: lastCheckedAt,
      kvWrite: false,
      error: String(error?.message || error),
    }, 503);
  }
}
