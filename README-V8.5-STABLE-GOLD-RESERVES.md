# V8.5 Stable Gold Reserves Engine

This release only changes the independent central-bank gold reserve module.

## First-run safety

The updater contains an embedded non-empty baseline. Even if a manual GitHub upload omits `assets/data/central-bank-gold-reserves.json`, the workflow recreates it automatically.

## Update behavior

- Existing valid records are preserved.
- Successfully refreshed countries are updated individually.
- Failed sources retain the last saved/baseline value.
- The workflow never publishes an empty reserve module.
- News Calendar, Admin, Forecast, Previous, Actual, Last Release, lifecycle, ETF and quote files are untouched.
