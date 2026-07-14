# Gold Hunter Stable — deployment notes

This build keeps the public website design and content unchanged. Changes are limited to data reliability, invisible analytics tracking, and the existing Admin page.

## Required Cloudflare Production bindings

- `GH_MARKET_DATA` — existing KV namespace binding
- `ADMIN_PIN` — existing admin PIN

## Optional: Analytics cards inside the existing Admin page

The public site continues sending enhanced events to the existing GA4 measurement ID `G-RMTE7H8TP1`.
To show GA4 data inside `/admin`, add these **Production** environment variables in Cloudflare Pages:

- `GA4_PROPERTY_ID` — numeric GA4 property ID, not the `G-...` measurement ID
- `GA4_CLIENT_EMAIL` — Google service-account email
- `GA4_PRIVATE_KEY` — service-account private key including BEGIN/END lines

Grant that service account **Viewer** access to the GA4 property.
Without these three variables, the Admin page remains usable and simply shows a setup message in the analytics area.

## Verification after deployment

1. Open `/api/market-events?refresh=1` and confirm `engineVersion` is `11-stable-data`.
2. After Cloudflare KV daily quota resets, edit one Forecast in `/admin` and save.
3. Confirm the save request returns HTTP 200.
4. Reopen `/api/market-events?refresh=2` and confirm the changed Forecast appears.
5. Open `/api/etf-engine`, `/api/rate-expectation-engine`, and `/api/gold-reserves-engine` and confirm each returns JSON.

## Data protection

- News and connector cache writes are change-only.
- Re-saving identical Forecast/Event data does not consume an additional KV write.
- Quotes cache uses the reduced-write implementation.
- Official data failures retain the last valid data rather than writing empty values.
