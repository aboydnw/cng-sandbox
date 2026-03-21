# Hetzner Deployment — Design Spec

**Status:** Draft
**Date:** 2026-03-21
**Context:** The CNG Sandbox runs on a Hetzner VM (16GB RAM) via Docker Compose. It needs to be accessible to coworkers over the internet for an internal demo, with HTTPS and basic password protection.

---

## Problem

The sandbox is only accessible on `localhost`. Coworkers can't see it without SSH access to the VM. Sharing it for feedback requires:

1. A public URL with HTTPS
2. Some form of access control (at minimum, keeping bots and crawlers out)
3. No changes to the existing Docker service architecture

## Solution

### 1. DuckDNS for a free subdomain

DuckDNS provides free dynamic DNS subdomains (`*.duckdns.org`). Register a subdomain (e.g., `cng-sandbox.duckdns.org`) that points to the VM's public IP.

**Setup (one-time, manual):**

1. Go to [duckdns.org](https://www.duckdns.org), sign in with GitHub/Google
2. Create a subdomain (e.g., `cng-sandbox`)
3. Note the token — needed for Caddy's DNS challenge

**IP update:** DuckDNS records can go stale if the VM's IP changes. Add a cron job to the VM that pings DuckDNS every 5 minutes to keep the record current. This is a standard DuckDNS pattern.

### 2. Caddy as reverse proxy

Add Caddy to the Docker Compose stack. It handles:

- **TLS termination** via Let's Encrypt, using the DuckDNS DNS-01 challenge (needed because the VM may not have port 80 open for HTTP-01)
- **Basic auth** to password-protect the entire site
- **Reverse proxying** all requests to the Vite dev server on port 5185
- **Gzip compression** via `encode gzip` (Vite dev server does not compress by default, and the JS bundles are large)

**Why Caddy proxies only to the Vite dev server:** The frontend's Vite server already proxies `/api`, `/raster`, `/vector`, `/pmtiles`, and `/storage` to the correct backend services. Rather than duplicating all that routing in Caddy, we proxy everything to Vite and let it handle internal routing. This is one line of Caddy config instead of five proxy rules with path rewrites.

**Why keep the Vite dev server:** For an internal demo, the Vite dev server is fine. It handles proxying and SPA routing. A production build (static files served by Caddy directly) would be better for performance, but that's optimization for later. Note: Vite opens an HMR WebSocket to connected browsers. Caddy proxies WebSockets by default, so coworkers may see harmless HMR reconnection noise in the browser console.

**Caddy image:** Use a custom Caddy image that includes the `caddy-dns/duckdns` plugin for DNS-01 challenges. This is built with a simple Dockerfile using Caddy's builder pattern.

### 3. Docker Compose changes

Add two new files and modify the compose file.

**Use a Compose profile** to keep Caddy out of the default local dev workflow. The `caddy` service gets `profiles: [prod]` so it only starts when explicitly requested:

- Local dev: `docker compose up -d` (no Caddy, frontend on port 5185 as before)
- Production: `docker compose --profile prod up -d` (Caddy on 80/443, frontend not exposed)

**`Caddyfile`** (project root):

```
{$SITE_ADDRESS} {
    tls {
        dns duckdns {$DUCKDNS_TOKEN}
    }

    basic_auth {
        {$AUTH_USER} {$AUTH_PASSWORD_HASH}
    }

    encode gzip

    reverse_proxy frontend:5185
}
```

**Bcrypt hash escaping:** The `AUTH_PASSWORD_HASH` value contains `$` characters (e.g., `$2a$14$...`). In the `.env` file, wrap the hash in single quotes or escape the `$` signs to prevent shell/Caddy variable interpolation. Test this during implementation — it's a known Caddy footgun.

**`caddy/Dockerfile`:**

```dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

**`docker-compose.yml` additions:**

```yaml
caddy:
  build:
    context: caddy
  restart: unless-stopped
  profiles:
    - prod
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
    - caddy_config:/config
  environment:
    SITE_ADDRESS: ${SITE_ADDRESS:-localhost}
    DUCKDNS_TOKEN: ${DUCKDNS_TOKEN}
    AUTH_USER: ${AUTH_USER:-demo}
    AUTH_PASSWORD_HASH: ${AUTH_PASSWORD_HASH}
  depends_on:
    frontend:
      condition: service_started
```

Add `caddy_data` and `caddy_config` to the volumes section.

### 4. Environment variables

Add to `.env`:

```
# Deployment (only needed when running with --profile prod)
SITE_ADDRESS=cng-sandbox.duckdns.org
DUCKDNS_TOKEN=<from duckdns.org>
AUTH_USER=demo
AUTH_PASSWORD_HASH='<bcrypt hash from: docker run --rm caddy caddy hash-password>'
```

**Password hash generation:** Run `docker run --rm caddy caddy hash-password --plaintext 'your-password'` to generate the bcrypt hash. Wrap the result in single quotes in `.env`.

### 5. CORS origins

The ingestion service's `CORS_ORIGINS` env var currently only allows `http://localhost:5185`. Requests from the DuckDNS domain will fail CORS preflight checks (notably file uploads, which use POST with JSON). Add the production URL:

```yaml
CORS_ORIGINS: '["http://localhost:5185", "https://${SITE_ADDRESS}"]'
```

This uses the same `SITE_ADDRESS` variable. When running locally without a `SITE_ADDRESS`, the second origin is harmless.

### 6. Frontend port mapping

When running with the `prod` profile, the frontend's `ports: - "5185:5185"` mapping is unnecessary since Caddy handles external access. However, since we're using profiles, local dev still needs the port mapping. **Keep the port mapping as-is** — it only matters for local dev, and in production the Hetzner firewall will block direct access anyway (see section 8).

### 7. DuckDNS cron job

A small script with hardcoded values (cron runs in a minimal environment without access to shell variables):

```bash
#!/bin/bash
# Update DuckDNS record — values hardcoded because cron has no env context
SUBDOMAIN="cng-sandbox"
TOKEN="<paste token here>"
curl -s "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip="
```

This runs every 5 minutes via `crontab -e`:
```
*/5 * * * * /home/anthony/projects/cng-sandbox/scripts/update-duckdns.sh >> /var/log/duckdns.log 2>&1
```

### 8. Hetzner firewall

Configure the firewall to only expose necessary ports to the internet. There are two layers:

**Hetzner Cloud firewall** (web console at console.hetzner.cloud → Firewalls):
- Allow inbound TCP 22 (SSH)
- Allow inbound TCP 80, 443 (Caddy/HTTPS)
- Block everything else (this prevents direct access to ports 8000, 8081-8083, 5185, 5439, 9000-9001)

**OS-level firewall** (`ufw` on Ubuntu): The Hetzner Cloud firewall is sufficient, but if `ufw` is enabled, ensure it also allows 22, 80, 443.

Backend service ports remain accessible on `localhost` for debugging via SSH tunnel (e.g., `ssh -L 8000:localhost:8000 vm`).

---

## What this does NOT include

- **Production frontend build** — Vite dev server is fine for internal demo
- **Rate limiting** — basic auth is sufficient access control for now
- **Monitoring/alerting** — not needed for demo
- **Automated deployment/CI** — manual `docker compose --profile prod up -d --build` is fine
- **Custom domain** — DuckDNS subdomain is sufficient; custom domain requires Cloudflare access from a developer
- **Multi-user auth** — single shared password is fine for internal demo

## Dependencies

- DuckDNS account and subdomain (manual setup)
- Hetzner VM with ports 22, 80, and 443 open in firewall (both Hetzner Cloud and OS-level if applicable)

## Risks

- **DuckDNS downtime:** If DuckDNS is down, new DNS lookups fail. Cached lookups still work. Low risk for an internal demo.
- **Let's Encrypt rate limits:** DuckDNS subdomains share the `duckdns.org` registered domain's 50-cert/week limit across all users. In practice this is not an issue because renewals of the same name don't count toward the limit.
- **Vite dev server in production:** HMR websocket connections and dev-mode overhead are unnecessary. Coworkers may see console noise from HMR. Acceptable for demo; switch to static build before wider use.
- **Bcrypt hash escaping:** The `$` characters in bcrypt hashes can be misinterpreted by Docker Compose, the shell, or Caddy's env var parser. This must be tested during implementation.
