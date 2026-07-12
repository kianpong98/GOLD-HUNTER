# v10.0.3 Forecast Single API Fix

- Forecast save and website read now use the same `/api/market-events` endpoint and the same KV record.
- Removed the separate forecast endpoint dependency from Admin and public Calendar.
- Admin re-reads `/api/market-events` immediately after save and verifies every event by stable event ID.
- This avoids Cloudflare route/binding differences between two endpoints.
- All other site functions and SEO are retained.
