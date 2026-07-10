# Gold Hunter Platform V1 trial

Included:
- Sticky mobile/desktop market strip with all four sessions, open sessions first, and open/close countdowns to the second.
- XAU/USD and DXY quote cards. XAU uses Gold API. DXY uses the Stooq DX futures CSV as a delayed proxy.
- Market Tools order: Gold News, SPDR Gold ETF, Live Market.
- SPDR GLD official 30-day holdings workflow and expandable 30-day table.
- Calendar past releases can display Gold reaction fields: `gold5m`, `gold30m`, `gold1h`.

## ETF daily sync
The workflow `.github/workflows/update-etf-holdings.yml` downloads the official SPDR GLD historical archive and updates `assets/data/spdr-gld-holdings.json` on weekdays. In GitHub Settings → Actions → General, enable **Read and write permissions**.

Run it immediately from GitHub → Actions → **Update SPDR GLD holdings** → Run workflow.

## Cloudflare
Keep the existing KV binding `GH_MARKET_DATA` and secret `ADMIN_PIN`. The new `/api/market-snapshot` endpoint uses the same KV binding only as a short fallback cache; it still works without KV, but stale fallback will be unavailable.

## Important
- DXY is a free delayed proxy, not an exchange-grade live feed.
- ETF holdings are daily official data, not intraday data.
- Gold reaction history is not fabricated. It appears only when those fields exist in event history data.
