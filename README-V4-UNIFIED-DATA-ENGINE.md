# Gold Hunter V4 — Unified Official Data Engine

## What is connected
- CPI / Core CPI
- PPI / Core PPI
- Nonfarm Payrolls
- Unemployment Rate
- Average Hourly Earnings MoM
- Retail Sales
- Initial Jobless Claims
- GDP
- PCE / Core PCE
- FOMC target-rate range
- FOMC meeting dates and minutes dates
- Federal Reserve speeches entered through Admin remain time/status events

## Automatic release flow
1. Official schedule generator keeps future release dates updated.
2. Official data workflow checks every 5 minutes.
3. The Cloudflare API also checks runtime official sources and selects the newest observation, so a new Actual can appear before the next static deployment.
4. When `official period == event releasePeriod`, Actual is attached to that event.
5. Actual is compared with the Admin-entered Forecast.
6. The site displays Above / Below / In Line, numeric difference, surprise strength and the typical Gold interpretation.

## Direction rules
- Higher inflation, wages, payrolls, retail sales, GDP, PCE or policy rate: typically negative for Gold.
- Higher unemployment or jobless claims: typically supportive for Gold.
- In-line data: typically neutral.

These labels are general macro interpretations, not trading signals. Revisions, market positioning and the full FOMC statement can cause a different price reaction.

## Setup after upload
Run these GitHub Actions once:
1. `Update official release schedule`
2. `Update official calendar data`

Cloudflare must keep the `GH_MARKET_DATA` KV binding and `ADMIN_PIN` environment variable used by the existing site.
