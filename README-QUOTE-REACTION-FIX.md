# Quote persistence + Past Release reaction fix

- XAU and DXY keep the last successful value on screen and in localStorage.
- A temporary quote/API failure no longer replaces the number with a dash.
- The fixed header re-renders every second without wiping XAU/DXY.
- Past Release Gold Reaction values (5m / 30m / 1h) can now be entered from admin.html and are saved in GH_MARKET_DATA KV.

Note: Gold reaction values are not official economic data. They require a historical XAU price source, so this version stores verified values entered by the administrator instead of inventing them.
