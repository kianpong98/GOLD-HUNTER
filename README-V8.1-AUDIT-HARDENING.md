# V8.1 Audit Hardening

- FOMC parser only accepts official meeting date ranges, preventing minutes release dates from becoming false rate decisions.
- generated-events.json is schedule-only; user Forecast/Actual/Previous/History remain in Cloudflare KV.
- Workflow validation rejects duplicate schedule keys, unexpected event types, and data-state leakage.
- FOMC Minutes fallback uses the same meeting releasePeriod as the official schedule.
