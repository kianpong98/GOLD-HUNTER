# Gold Hunter V4.3 — Previous Value Fallback

Changes:
- Admin-entered Previous values are preserved during official connector outages.
- Upcoming events use the latest official Actual as Previous.
- Official history is used when a metric summary is temporarily unavailable.
- Empty first-deploy caches no longer overwrite a saved Previous value.
- Missing values show `Previous awaiting official sync` and can be filled in `/admin`.

After deployment:
1. Run `Update official calendar data` in GitHub Actions.
2. Open `/admin` and fill only any remaining Previous fields.
3. Save. Manual values remain until an official replacement is available.
