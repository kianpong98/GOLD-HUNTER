# V8.4 Gold Reserves Stable Source

This release changes only the independent central-bank gold reserve module.

- Ships with a verified non-empty World Gold Council / IMF IFS snapshot.
- The website no longer waits for a first sync when WGC blocks GitHub runners.
- The monthly workflow attempts to refresh each country independently through public country summaries that cite World Gold Council data.
- A failed country request retains that country's previous verified value.
- Partial responses never erase the full snapshot.
- Calendar, Admin, Forecast, Previous, Actual, Last Release, quotes and ETF files are unchanged.
