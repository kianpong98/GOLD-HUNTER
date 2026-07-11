# Gold Hunter Calendar Setup

This version includes a working Cloudflare Pages Function and mobile calendar admin.

## Cloudflare setup

1. Create a KV namespace, for example: `gh-market-data`.
2. In Cloudflare Pages project settings, add a KV binding:
   - Variable name: `GH_MARKET_DATA`
   - Namespace: the KV namespace created above
3. Add an encrypted secret:
   - Name: `ADMIN_PIN`
   - Value: your private PIN
4. Redeploy the latest GitHub commit.

## Use from phone

Open:

`https://goldhunter.site/admin.html`

Enter the PIN, edit Forecast / Previous / Actual, then tap **Save Calendar**.

The public calendar is:

`https://goldhunter.site/calendar.html`

The homepage also shows the next three events.

## Important

The included initial release dates are based on official U.S. agency schedules. Forecast values are entered manually. Actual and Previous fields are editable in the mobile admin. Official automatic value syncing is not enabled in this package.
