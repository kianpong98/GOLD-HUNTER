# V8.7 Rate expectation

- Removed the Gold Share field from reserve cards, country table, updater and workflow validation.
- Kept central-bank holdings and monthly-change data unchanged.
- Added a Fed rate expectation card for cut / hold / hike probabilities.
- Data file: `assets/data/rate-expectation.json`.
- Source link: CME FedWatch.

CME's direct FedWatch API is a subscribed market-data product, so this version does not invent or scrape unreliable probabilities. Enter the latest three probabilities in the JSON file; the website will immediately render the leading expectation and its general gold implication.
