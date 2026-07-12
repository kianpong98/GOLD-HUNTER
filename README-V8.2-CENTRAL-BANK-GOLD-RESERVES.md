# V8.2 — Central Bank Gold Reserves (Additive Only)

This release adds an isolated Central Bank Gold Reserves module without changing the economic calendar, Admin, Forecast, Previous, Actual, Last Release, release lifecycle, or news deduplication.

## Added
- `scripts/update_gold_reserves.py`
- `.github/workflows/update-gold-reserves.yml`
- `assets/data/central-bank-gold-reserves.json`
- `functions/api/gold-reserves-engine.js`
- A new homepage card under Market Tools

## Source and frequency
- Primary source: World Gold Council official holdings dataset, compiled from IMF IFS.
- The workflow checks four times per month and can also be run manually.
- Sync is non-destructive: if the official file is unavailable or changes format, the last successful snapshot is retained.

## Isolation guarantee
The module uses its own file, API endpoint and KV key (`central-bank-gold-reserves-v1`). It does not read or write `gold-market-events-v3`, news Forecasts, release histories, or any calendar data.
