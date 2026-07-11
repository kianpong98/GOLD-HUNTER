# Gold Hunter V3.3 — Official calendar automation

## Added
- Average Hourly Earnings MoM from BLS series `CES0500000003`.
- Automatic future schedule generator from official BLS, BEA, Census and Federal Reserve pages.
- FOMC Minutes and Federal Reserve speeches use event-only display (time/status; no fake Actual/Previous).
- Actual/Previous workflow checks every 5 minutes and commits only when official data changes.
- Actual vs Forecast: Above / Below / In Line.
- General gold-impact label: typically supportive / negative / neutral for Gold.

## GitHub Actions
Run these manually once on `feature/news-engine`:
1. `Update official release schedule`
2. `Update official calendar data`

Scheduled workflows run long-term from the default branch after merge to `main`.

## Notes
- Forecast remains entered in `/admin.html`.
- Gold-impact labels are general macro interpretations, not trading signals.
- FOMC statements and speeches cannot be classified reliably from the headline number alone.
