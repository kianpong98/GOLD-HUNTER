Gold Hunter V6 Final Stable

Release lifecycle:
1. Before release: Admin enters Next Forecast. Previous comes from official latest/history/cache.
2. Release day: Actual appears only when the official period exactly matches the event releasePeriod.
3. Next Malaysia day: released row is archived automatically; Actual becomes the next Previous; current Forecast and Actual reset.
4. Archive stores up to 100 releases per event. Calendar/Admin display the latest 10.
5. A scheduled GitHub workflow calls the lifecycle endpoint daily at 03:05 Malaysia time. Page/API visits also run the same idempotent lifecycle check.
6. Forecast values are never replaced by official sync. Historical forecasts remain editable by period.
7. Admin and Calendar both read /api/market-events, so they use the same deduplicated event list.

Cloudflare requirements:
- GH_MARKET_DATA KV binding
- ADMIN_PIN secret

After upload:
- Deploy to Cloudflare Pages.
- Run Update official calendar data once.
- Run Update official release schedule once.
- Run Run release lifecycle once to verify the endpoint.
