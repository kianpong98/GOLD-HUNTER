# Gold Hunter Admin V4.2

## Cloudflare settings required

In Cloudflare Pages > Settings > Functions:

1. KV binding
   - Variable name: `GH_MARKET_DATA`
   - Bind it to your existing Gold Hunter KV namespace.
2. Environment variable / secret
   - Name: `ADMIN_PIN`
   - Value: your private PIN.
3. Add both settings to Production. Add them to Preview too if you test Preview deployments.
4. Redeploy the latest GitHub commit after saving the bindings.

## Open the admin

- `https://goldhunter.site/admin`
- Backup URL: `https://goldhunter.site/admin.html`

The admin can:

- edit Forecast;
- edit Malaysia release date and time;
- enter/fix Previous when needed;
- view official connector status;
- filter Awaiting official sync;
- filter missing Forecast values;
- view BLS, FRED, static cache and KV health.

Actual remains read-only and is filled by the official data engine after release.

## Forecast behavior

Forecast values are saved to Cloudflare KV. The public calendar reads them immediately from `/api/market-events`; a GitHub commit is not required for each Forecast edit.
