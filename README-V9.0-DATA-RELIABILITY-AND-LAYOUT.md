# Gold Hunter v9.0 — Data Reliability & Balanced Market Tools

## Reliability changes
- BLS bulk requests now fall back to isolated per-series official API requests.
- Release watcher checks every 25 seconds for up to 10 minutes inside the release window.
- Both the static official cache and authenticated Cloudflare KV refresh are triggered.
- A separate verification workflow flags any release that is still missing Actual during the first 20 minutes.
- Existing Actual, Previous, Forecast and release history remain non-destructive when a provider fails.

The system targets delivery within 30 seconds to 5 minutes when an official provider has published and at least one configured path is reachable. No internet-based system can truthfully guarantee delivery while every upstream provider is unavailable.

## Homepage
- Four equal market cards in a responsive 2×2 layout: ETF / Fed Rate / Central Bank / Calendar.
- Fed Rate now shows Current Rate, Expected Rate, Probability, Expected Move in bps and Gold direction.
