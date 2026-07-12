# Gold Hunter v8.8 — Fed Rate Target Ranges

- Replaced generic cut / hold / hike cards with target-range probabilities.
- Example included: 3.50%–3.75% at 78%, 3.75%–4.00% at 22%.
- Added leading outcome, probability meters, current target range, next FOMC date, and gold-impact summary.
- Added a direct JSON fallback so the panel still loads when the Cloudflare API route is unavailable.
- Existing news, ETF, quotes, calendar, and gold-reserve features were left unchanged.

Edit `assets/data/rate-expectation.json` to update the displayed probabilities.
