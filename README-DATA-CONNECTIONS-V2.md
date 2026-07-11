# GH Market Data Connections V2

## Economic data
The Cloudflare Pages Function `/api/market-events` now combines:
- BLS Public Data API: CPI, Core CPI, PPI, Core PPI, NFP, Unemployment Rate.
- FRED CSV series backed by official agencies: Average Hourly Earnings, Retail Sales, Initial Jobless Claims, GDP, PCE, Core PCE and the Federal Funds target range.
- ISM events remain editable in Admin because ISM does not provide the same open government API coverage.
- Event-only releases such as FOMC Minutes display `Not applicable` instead of a blank Previous value.

Forecast remains editable from `admin.html`. Numeric Previous values come from the automatic connector when available; manual fallback is retained for non-open sources.

## XAU and DXY
`/api/market-snapshot` uses two quote sources per instrument and stores the last successful quote in Cloudflare KV for seven days. The page polls every 3 seconds and never clears a valid displayed price when a provider briefly fails.

## SPDR GLD ETF holdings
Run the GitHub Action **Update SPDR GLD holdings** once after upload. It downloads the official archive and writes the latest 30 records to `assets/data/spdr-gld-holdings.json`. The action also runs every weekday.

Cloudflare bindings required:
- KV: `GH_MARKET_DATA`
- Secret: `ADMIN_PIN`
