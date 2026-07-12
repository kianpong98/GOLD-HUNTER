# Gold Hunter v9.0.1 — Forecast Live Sync Fix

- Admin Forecast writes are authoritative, including replacement and clearing.
- Website calendar bypasses browser/CDN cache with a timestamped API request.
- Calendar refreshes every 30 seconds, on tab focus, and immediately after an Admin save in another same-origin tab.
- API GET responses explicitly disable browser, proxy, and Cloudflare CDN caching.
- All v9.0 features remain unchanged.
