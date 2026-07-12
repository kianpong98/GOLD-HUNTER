# V7.4 Non-destructive News Merge

- Calendar schedule and API now share the same canonical key: type + releasePeriod.
- Schedule refresh preserves forecast, previous, actual, lastRelease, releaseHistory, releaseForecasts and archive metadata.
- API writes merge with existing KV instead of replacing it.
- Existing KV is backed up to `gold-market-events-v3-backup` before each write.
- Legacy duplicate rows are collapsed while user-entered fields are retained.
