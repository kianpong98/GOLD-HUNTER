# v10.1.1 Event + Forecast Override Fix

- Admin now stores both Forecast and Malaysia event datetime in one independent KV override layer.
- Website applies the admin override after the authoritative schedule merge, so workflows cannot overwrite the saved values.
- Save verification checks both Forecast and event datetime through the public website API.
- Other website features and SEO are unchanged.
