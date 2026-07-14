# Data Engine Audit — Stable Data 1

## Changed

1. `functions/api/data-engine.js`
   - Unified engine version.
   - Admin submissions now merge with previously saved overrides, so partial saves cannot erase untouched forecasts/events.
   - Existing change-only KV protection and read-back verification remain enabled.

2. `functions/api/etf-engine.js`
   - GET requests are now read-only and never call `KV.put()`.
   - Selects the freshest valid static/KV snapshot.
   - Returns explicit `live`, `cached`, or `offline` status and official data date.

3. `functions/api/gold-reserves-engine.js`
   - GET requests are now read-only and never call `KV.put()`.
   - Validates the full reserve dataset and chooses the freshest valid snapshot.
   - Returns explicit source and health metadata.

4. `functions/api/rate-expectation-engine.js`
   - Preserves exact CME probability values.
   - Uses CME authenticated API when configured, otherwise verified public-page parsing.
   - Uses Cache API only; no Workers KV writes.
   - Explicitly labels live, cached-last-good, and static-fallback states.

## Not changed

- Public website layout
- HTML pages
- CSS
- SEO
- Gallery, results, reviews, membership content
- Admin interface layout

## Verification performed

- JavaScript syntax checks passed for all four modified engines.
- Python update scripts compile successfully.
- No new KV write path was introduced.
