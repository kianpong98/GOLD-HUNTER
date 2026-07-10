# Gold Hunter News Engine — Branch Trial

Upload the extracted files to the `feature/news-engine` branch root.

## Cloudflare Preview setup
1. Cloudflare Pages > your project > Settings > Bindings.
2. Create a KV namespace, for example `gh-market-data`.
3. Add a KV binding for **Preview** and **Production**:
   - Variable name: `GH_MARKET_DATA`
   - Namespace: `gh-market-data`
4. Add an encrypted secret for **Preview** and **Production**:
   - Name: `ADMIN_PIN`
   - Value: your private 6-digit PIN
5. Redeploy the preview branch.

## Test URLs
- Preview home: use the branch preview URL Cloudflare gives you.
- Calendar: `/calendar.html`
- Forecast admin: `/admin.html`
- API check: `/api/market-events`

## What works in this trial
- Fixed market-session strip, calculated in the browser.
- 4-star / 5-star calendar cards with English + Chinese names.
- Short Chinese explanation appears only after tapping `为什么重要？`.
- Mobile Forecast Admin saves to Cloudflare KV.
- BLS official Actual / Previous auto-read for CPI, Core CPI, PPI, Core PPI, NFP, and Unemployment Rate.

## Important limitation
- Event dates are stored in KV/seed data. This trial does not automatically scrape every agency release calendar.
- GDP, PCE, FOMC, Powell speeches, Retail Sales, Jobless Claims and ISM connectors are not automated in this trial; they remain listed with official source links and blank Actual/Previous until their connectors are added.
