# Gold Hunter V7.3 — Audit Fix

This release keeps the existing Calendar, Admin, Forecast, Previous, Actual,
Last Release, unique-news-ID and duplicate-cleanup behaviour.

Changes:

- FOMC Actual now uses the Federal Reserve's official FOMC statement as the
  primary release-day source.
- FRED target-range series remains a fallback.
- FOMC date matching uses the U.S. Eastern Time statement date, avoiding the
  Malaysia-after-midnight date mismatch.
- The most recent 10 FOMC meeting releases are collected, including meetings
  where the target range was unchanged.
- Official history merges preserve older valid rows instead of allowing a
  shorter refresh to erase them.
- The Actual Watcher starts every five minutes and performs a six-minute burst
  of 30-second checks during an active release window.
