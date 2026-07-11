# Gold Hunter Platform V2

This branch package keeps the existing website and reorganises the market-data layer.

## Cloudflare bindings

- KV binding: `GH_MARKET_DATA`
- Secret: `ADMIN_PIN`

Test after deployment:

- `/api/system-health`
- `/api/market-events`
- `/api/market-snapshot`
- `/calendar.html`
- `/admin.html`

## ETF workflow

The ETF workflow now runs when its workflow/script is pushed to `main` or `feature/news-engine`, and can also be run manually.

Important: GitHub normally lists workflow names from the default branch in the left Actions menu. A branch workflow can still run on a matching branch push. To permanently show it in the sidebar and enable scheduled runs, merge the workflow file into `main` after preview testing.

## Quotes

XAU and DXY use multiple fallback sources. The last successful values are retained in Cloudflare KV and browser local storage so temporary source failures do not reset the display to zero or a dash.
