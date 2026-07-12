# Gold Hunter V8 — Schedule/Data Separation

- `data/generated-events.json` and the bundled verified schedule are the only source of event names, dates and times.
- Cloudflare KV stores state only: Next Forecast, Previous, Actual, Last Release, release history and historical forecasts.
- KV rows can no longer create calendar dates or revive stale FOMC/CPI/PPI events.
- When an official schedule date is corrected, user-managed Forecast and history are migrated by metric type without migrating an old Actual.
- Homepage Upcoming events show future events only.
- API responses are no-store to prevent an old calendar from remaining in edge/browser cache.

After deployment run `Cleanup duplicate news` once to rewrite KV against the authoritative V8 schedule.
