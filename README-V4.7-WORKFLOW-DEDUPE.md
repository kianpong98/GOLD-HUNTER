# Gold Hunter V4.7 — Workflow Push & News Deduplication Fix

## Fixed
- All repository-writing GitHub Actions now share one concurrency group.
- ETF, quotes, calendar, official data and gallery workflows fetch/rebase before push and retry up to five times.
- News events are deduplicated by `type + releasePeriod`; event-only news uses `type + datetime minute`.
- Cloudflare API, schedule generator and browser rendering all apply the same defensive deduplication rule.
- Forecast and Last Release lifecycle fields are preserved when duplicate rows are merged.

## Deploy
Upload all files to the repository and let Cloudflare deploy the latest commit. Then run:
1. Update official calendar data
2. Update official release schedule
3. Update SPDR GLD holdings
4. Update quote cache
