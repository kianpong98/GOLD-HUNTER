# V8.3 Gold Reserves First-Sync Fix

This additive patch changes only the central-bank gold-reserves updater.

- Uses official WGC XLSX download links plus automatic future-link discovery.
- A first sync with zero rows now fails visibly instead of returning a misleading success.
- Existing successful reserve snapshots remain non-destructive on later source outages.
- No Calendar, Admin forecast, news lifecycle, ETF or quote code is changed.
