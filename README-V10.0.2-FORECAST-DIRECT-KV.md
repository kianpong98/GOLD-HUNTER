# V10.0.2 Forecast Direct KV

- Forecast now has an independent Cloudflare KV endpoint: `/api/forecast-overrides`.
- Admin saves to both the event engine and the independent forecast store.
- Admin reads the value back after saving and reports an error if verification fails.
- Website reads both endpoints and overlays Forecast client-side, so workflow schedule merges cannot hide or overwrite the Admin value.
- Existing SEO, layout, news, ETF, Fed Rate, reserves, calendar, quotes and admin functions are otherwise unchanged.
