# Gold Hunter v8.8.1 — Rate Expectation Loading Fix

- Fixes deployments where `/api/rate-expectation-engine` returns the site HTML with HTTP 200 instead of JSON.
- Tries the API, then relative static JSON, then root static JSON.
- Includes a built-in display fallback so the panel never remains unavailable.
- Does not modify News, Calendar, ETF, Quotes, gallery, or gold-reserve logic.
