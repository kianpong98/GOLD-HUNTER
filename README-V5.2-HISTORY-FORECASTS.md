# Gold Hunter V5.2

- Admin and Calendar continue to use the same deduplicated `/api/market-events` response.
- Numeric events use merged BLS, FRED and static histories; an empty runtime history no longer overwrites a working fallback history.
- Previous uses the newest valid official published value and stays automatic/read-only.
- Admin exposes the latest 10 release rows for each numeric event.
- Forecast for each historical release is stored by `type + release period` in Cloudflare KV.
- Editing historical forecasts does not alter Actual, Previous, the next Forecast, or create duplicate events.
