# Gold Hunter Stable Data Engine 1

Scope: data engines only. No website layout, SEO, gallery, membership, or public-page design was changed.

## Data paths

- Economic news: `/api/market-events` -> `functions/api/data-engine.js`
- ETF holdings: `/api/etf-engine` -> verified static snapshot, KV is read-only fallback
- Fed rate probabilities: `/api/rate-expectation-engine` -> CME official API when token exists, otherwise public CME table; Cache API only, no KV writes
- Central-bank gold: `/api/gold-reserves-engine` -> verified static snapshot, KV is read-only fallback

## Write policy

- Admin forecast/event overrides: KV write only when meaningful data changes.
- Official news caches/history: KV write only when meaningful official data changes.
- ETF and central-bank GET APIs never write KV.
- FedWatch never writes KV.

## Important limitation

Public CME page parsing is best effort. For the highest reliability, configure `CME_FEDWATCH_ACCESS_TOKEN` for CME's authenticated API. When live parsing fails, the API explicitly returns a cached/static status rather than claiming live data.
