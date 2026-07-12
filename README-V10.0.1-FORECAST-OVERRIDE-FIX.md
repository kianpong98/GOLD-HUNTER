# Gold Hunter v10.0.1 Forecast Override Fix

- Keeps all v10.0 SEO and website functionality.
- Stores Admin forecast edits in a dedicated Cloudflare KV override record.
- Forecast overrides are applied after schedule and official-data merges, so they cannot be overwritten by static schedule refreshes.
- Supports replacing and clearing forecasts.
- Public website continues cache-busting refresh every 30 seconds.
