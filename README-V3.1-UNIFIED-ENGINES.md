# Gold Hunter Platform V3.1

- `functions/api/data-engine.js`: unified official economic data engine.
- `functions/api/quotes-engine.js`: unified XAU/DXY quote engine with KV last-known fallback.
- `functions/api/etf-engine.js`: unified ETF endpoint; serves official synced JSON and preserves last-known data in KV.
- ISM Manufacturing / Services are filtered from seed data, saved KV data and the frontend.
- Mobile header order is Logo/Menu first, live market strip second, with authoritative no-overlap CSS.

Cloudflare bindings: `GH_MARKET_DATA` (KV), `ADMIN_PIN` (Secret).
ETF requires `.github/workflows/update-etf-holdings.yml` to be committed and run at least once.
