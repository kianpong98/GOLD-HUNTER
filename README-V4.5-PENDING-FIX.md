# Gold Hunter V4.5 — Official data pending fix

- Preserves Previous/Actual already stored in Cloudflare KV during schedule refreshes.
- Previous fallback order: current official metric → official history → Last Release → preserved KV/static value.
- A temporary connector delay no longer replaces a known Previous with a pending message.
- Current Actual is still accepted only when the official period exactly matches the event releasePeriod.
- Run Update official calendar data once after deployment to hydrate the static official cache.
