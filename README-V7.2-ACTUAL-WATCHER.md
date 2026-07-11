# Gold Hunter V7.2 — Actual Release Watcher

This update adds a release-window watcher without changing Calendar, Admin,
Forecast, Previous, Actual matching, Last Release, history or deduplication.

## Behaviour

- GitHub starts the watcher every 15 minutes.
- Outside a release window, it exits immediately.
- From 10 minutes before to 90 minutes after a scheduled numeric release, the
  active run checks every two minutes for up to 20 minutes.
- An authenticated `force=1` request bypasses the normal BLS/FRED runtime cache.
- Actual is accepted only when the live event has a non-empty Actual for the
  exact event type and release period.
- If the official source is late, the run remains successful and later
  scheduled runs continue automatically.
- The existing five-minute official-data workflow remains an independent backup.

## Required GitHub secret

Repository Settings → Secrets and variables → Actions:

- `ADMIN_PIN`: same value as the Cloudflare Pages `ADMIN_PIN`.
