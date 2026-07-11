# Gold Hunter V5.1 — Admin / Calendar Exact Sync

- Admin and Calendar now render the same deduplicated event array returned by `/api/market-events`.
- Removed the Calendar-only second deduplication pass that could make its count differ from Admin.
- Admin supports editing `lastRelease.forecast` for an archived release.
- Current/next Forecast remains separate from Last Release Forecast.
- Previous and Actual remain automatic and read-only.
- Saving preserves Last Release Actual, Previous, Period and DateTime.
