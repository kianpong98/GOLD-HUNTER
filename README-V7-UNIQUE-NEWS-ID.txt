Gold Hunter V7 — Unique News ID migration

Scope: news data identity/deduplication only.
Unchanged: Calendar UI, Admin UI, Forecast editing, Previous/Actual logic,
Last Release lifecycle, connector mappings, quote/ETF/gallery workflows.

Numeric event unique ID:
  canonical_type + releasePeriod
Example:
  nfp_2026_07
  unemployment_2026_07
  avg_hourly_earnings_2026_07

The API normalizes IDs on read and on every authorized write. Duplicate copies
are merged while retaining Forecast, Previous, Actual, Last Release, history,
and manually entered historical forecasts.
