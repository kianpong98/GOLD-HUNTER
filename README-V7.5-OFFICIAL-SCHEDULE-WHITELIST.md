# Gold Hunter V7.5 — Official Schedule Whitelist

- `data/generated-events.json` is authoritative for numeric macro releases and FOMC rows.
- KV records may enrich matching rows with Forecast, Previous, Actual, Last Release, releaseHistory, and releaseForecasts.
- Stored legacy rows may not create additional numeric/FOMC dates.
- Schedule-source success removes stale ghost rows; source failure preserves the prior matching schedule.
- FOMC uses the official decision date in US Eastern time as `releasePeriod`.
