# Cloudflare Worker API Setup

This API can be deployed to Cloudflare Workers with Hyperdrive so the frontend on Cloudflare Pages can talk to the existing MySQL database without a credit card.

## 1. Create Hyperdrive

In Cloudflare Dashboard:

1. Go to `Storage & databases`
2. Open `Hyperdrive`
3. Create a new Hyperdrive configuration
4. Use the existing MySQL credentials:
   - host: `ovh-sgp.opfw.me`
   - port: `3365`
   - database: `titanic_bramble`
   - user: `titanic_bramble`
   - password: your existing DB password
5. Copy the Hyperdrive ID

## 2. Update wrangler config

Edit `artifacts/api-server/wrangler.jsonc` and replace:

- `REPLACE_WITH_HYPERDRIVE_ID`

with the real Hyperdrive ID.

## 3. Set Worker secrets / vars

Set these in Cloudflare Workers:

- `ADMIN_MASTER_KEYS`
- `DISCORD_CLIENT_ID` (optional)
- `DISCORD_CLIENT_SECRET` (optional)
- `DISCORD_REDIRECT_URI` (optional)

If you want to bypass Hyperdrive temporarily, you can also set:

- `DATABASE_URL`

but Hyperdrive is the preferred setup on Cloudflare.

## 4. Deploy

From `artifacts/api-server`:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run cf:deploy
```

## 5. Frontend binding

After deploy, take the Worker URL and set it in Cloudflare Pages:

`VITE_API_BASE_URL=https://your-worker-url`

Then redeploy the Pages frontend.
