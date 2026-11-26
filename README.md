# Ad Dashboard (Private)

Zero-cost (`₹0`) private Earnings & Insights dashboard running on Cloudflare Workers + Workers KV + hourly Cron Trigger, deployed via GitHub Actions (`cloudflare/wrangler-action`).

## Secrets Setup

### GitHub Actions Secrets (`Settings -> Secrets and variables -> Actions`)
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers Scripts Edit + Workers KV Storage Edit + Account Settings Read
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID

### Worker Secrets (set via `npx wrangler secret put <NAME>` or Cloudflare Dashboard -> Workers & Pages -> `ad-dashboard` -> Settings -> Variables and Secrets)
- `DASH_PASSWORD` — HTTP Basic Auth password for user `pravesh`
- `ADSTERRA_API_TOKEN` — from `beta.publishers.adsterra.com -> Settings -> API`
- `CLICKADU_API_TOKEN` — from `pub.clickadu.com -> API` (optional until approved)
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` — OAuth client for GSC & Blogger
- `GSC_FILEBRIK_REFRESH_TOKEN` — `praveshrathore2002@gmail.com`
- `GSC_SHIFTANDTIP_REFRESH_TOKEN` — `rathore.monty2002@gmail.com`
- `BLOGGER_REFRESH_TOKEN` — `rathore.monty2002@gmail.com`
- `CF_ANALYTICS_TOKEN`, `CF_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG` — Cloudflare Web Analytics GraphQL

## Refreshing Expired Google OAuth Tokens
```bash
npm run reauth
```
