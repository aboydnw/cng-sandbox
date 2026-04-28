# Production Deployment (Hetzner)

Read this when deploying, debugging prod, changing Caddy auth rules, updating the CSP, or adjusting tile caching.

The sandbox can be deployed to a public URL with HTTPS using the `prod` Docker Compose profile. Shared `/map` / `/story` views are public; the rest of the SPA, write operations, and workspace listings are gated behind HTTP basic auth via Caddy.

## Auth model

Caddy applies basic auth selectively (see `Caddyfile`):

- **Public (no auth):** `/assets/*` (hashed SPA bundle), public static files shipped with the frontend (`/favicon.ico`, `/logo.svg`, `/gif.worker.js`, `/fonts/*`, `/thumbnails/*`) so shared-view pages can load them without triggering a basic-auth prompt, shared SPA views (`/map/*` including `/map/connection/*`, `/story/:id`, `/story/:id/embed`), `/storage/*` and `/pmtiles/*` (R2 proxies), `/cog/*`, `/raster/*`, `/vector/*`, individual resource reads like `GET /api/datasets/{id}`, `GET /api/connections/{id}`, `GET /api/stories/{id}`, `/api/proxy`, `/api/health`. This lets shared map/story URLs load for anyone without a password prompt, and lets PMTiles / DuckDB-WASM range requests succeed (they can't send basic auth).
- **Auth required:** all other SPA paths (root `/`, `/library`, `/discover`, `/about`, `/story/new`, `/story/:id/edit`, `/w/:workspaceId/*`) so the password prompt appears up front instead of surprising the user mid-flow; plus all non-GET/HEAD requests to `/api/*` (uploads, creates, updates, deletes) and workspace-listing reads (`GET /api/datasets`, `GET /api/connections`, `GET /api/stories`). API auth remains as defense-in-depth — the SPA gate alone doesn't stop someone from hitting the API directly.

## Prerequisites

1. **Domain:** Point an A record for your domain (e.g. `cngsandbox.org`) to the Hetzner VM's public IPv4 address. Caddy auto-obtains Let's Encrypt certs via HTTP-01 challenge.
2. **Hetzner firewall:** Allow inbound TCP 22, 80, 443 only (block all other ports from external access). Configure in the Hetzner Cloud console (Firewalls section). Also check the OS-level firewall: `sudo ufw status` — if active, ensure ports 80 and 443 are allowed (`sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`)
3. **Generate a password hash:**
   ```bash
   docker run --rm caddy caddy hash-password --plaintext 'your-password'
   ```

## Configure

Edit `.env` on the VM and fill in the deployment variables:

```
SITE_ADDRESS=cngsandbox.org
AUTH_USER=demo
AUTH_PASSWORD_HASH=$$2a$$14$$... (escape $ as $$ for Docker Compose)
```

## Start

```bash
docker compose --profile prod up -d --build
```

## Verify

- Visit `https://cngsandbox.org` — should prompt for username/password immediately (root is gated)
- After authing, verify the SPA loads and uploads work end-to-end
- Open a shared map URL (e.g. `https://cngsandbox.org/map/<dataset-id>`) in an incognito window — should load without any prompt

## Notes

- `docker compose up` (without `--profile prod`) still runs local dev without Caddy
- Backend service ports (8081-8086) are accessible on localhost via SSH tunnel but blocked externally by the Hetzner firewall
- The `caddy_data` volume persists TLS certificates — don't delete it or you'll hit Let's Encrypt rate limits
- Caddy applies baseline security headers to every response (HSTS, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). The CSP allows `'wasm-unsafe-eval'` for DuckDB-WASM, whitelists `https://static.cloudflareinsights.com` (Cloudflare Web Analytics beacon) and `https://plausible.io` (Plausible analytics tracker) on `script-src`, and is permissive on `connect-src`/`img-src` to accommodate user-supplied tile URLs and the CARTO basemap. Story video chapters embed YouTube and Vimeo iframes, so `frame-src` lists `https://www.youtube.com`, `https://www.youtube-nocookie.com`, and `https://player.vimeo.com`. When adding any new third-party script or iframe origin, update both the `Caddyfile` CSP and this note

### EPSG resolution

The frontend bundles an inline subset of EPSG codes (31 curated codes plus all 120 UTM zones) used to reproject non-Mercator COGs without a runtime network fetch. Codes outside the subset fall back to fetching `https://epsg.io/{code}.json` via the deck.gl-geotiff default resolver. If a deployment-level CSP blocks `epsg.io`, uncommon CRSes will fail to render; common CRSes (Web Mercator, NAD83/Conus Albers, all UTM zones, common European and polar projections) are unaffected.

- Tile responses (`/cog/*`, `/raster/*`, `/vector/*`) are served with `Cache-Control: public, max-age=3600`. Tile URLs are immutable per dataset (a change to the underlying data produces a new STAC item id or query param), so a 1-hour browser cache is safe and reduces Hetzner egress
- `/storage/*` (R2 proxy) responds with `Access-Control-Allow-Origin: *` and preflight handling for `OPTIONS`, so shared COGs can be fetched cross-origin by external tile/raster clients. The path is already public at the edge; CORS just unblocks browsers from reading the bytes on a non-sandbox origin
- Per-endpoint rate limiting is enforced inside the ingestion service (slowapi), not in Caddy. Limits are keyed by `X-Workspace-Id` when present, otherwise by remote IP (`get_remote_address`). When sitting behind a proxy that does not forward the client IP, abuse logs and rate-limit buckets will collapse to the proxy's address — pass through `X-Forwarded-For` if you need per-client granularity. Per-endpoint limits are catalogued in [api-reference.md](api-reference.md)
