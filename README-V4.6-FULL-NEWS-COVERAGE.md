# Gold Hunter V4.6 — Full News Coverage

## Connected automatic metrics
- CPI YoY
- Core CPI YoY
- PPI YoY
- Core PPI YoY
- Nonfarm Payrolls
- Unemployment Rate
- Average Hourly Earnings MoM
- Retail Sales MoM
- Initial Jobless Claims
- GDP
- PCE YoY
- Core PCE YoY
- FOMC target range

FOMC Minutes and Fed speeches remain event-only because they do not publish a numeric Actual/Previous value.

## Fixes
- Full seed schedule is always retained when an official schedule page fails.
- Existing Forecast and lifecycle data are preserved during schedule refresh.
- BLS and FRED data are merged by event type.
- FRED requests run in parallel and use shorter retries so one slow series cannot block all Previous values.
- Old observations may populate Previous but can never populate a new release's Actual.
- Actual appears only when the official period exactly equals releasePeriod and release time has passed.

## First deployment
1. Upload all files to GitHub.
2. Run `Update official calendar data`.
3. Run `Update official release schedule`.
4. Confirm Cloudflare deployed the resulting commits.
5. Open `/admin` and check System Status / Previous values.
