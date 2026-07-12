# Gold Hunter v10.1 — Data Engine v2

Forecast is now stored in an independent, admin-owned Cloudflare KV key:
`market-admin-forecast-overrides-v3`.

- Admin writes only forecast overrides through `/api/admin-forecasts`.
- Official workflows continue to update schedule, Actual, Previous and history.
- `/api/market-events` overlays the admin forecast last, so workflows cannot overwrite it.
- Admin verifies both the KV write and the public website API before showing success.
- Overrides are keyed by `type|releasePeriod`, avoiding unstable event IDs.
