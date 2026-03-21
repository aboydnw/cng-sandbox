# Hetzner Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CNG Sandbox accessible to coworkers at `https://<subdomain>.duckdns.org` with HTTPS and basic auth.

**Architecture:** Caddy reverse proxy sits in front of the existing Vite dev server, handling TLS (via DuckDNS DNS-01 challenge) and basic auth. Uses Docker Compose profiles so `docker compose up` still works for local dev, while `docker compose --profile prod up` adds Caddy.

**Tech Stack:** Caddy 2, DuckDNS, Docker Compose profiles, Let's Encrypt

**Spec:** `docs/superpowers/specs/2026-03-21-hetzner-deployment-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `caddy/Dockerfile` | Create | Custom Caddy image with DuckDNS DNS plugin |
| `Caddyfile` | Create | Reverse proxy config: TLS, basic auth, gzip, proxy to frontend |
| `scripts/update-duckdns.sh` | Create | Cron script to keep DuckDNS IP record current |
| `docker-compose.yml` | Modify | Add `caddy` service with `profiles: [prod]`, add volumes |
| `.env` | Modify | Add deployment variables (SITE_ADDRESS, DUCKDNS_TOKEN, AUTH_*) |
| `.env.example` | Modify | Same additions as `.env` but with placeholder values |
| `.gitignore` | Modify (if needed) | Ensure `.env` is ignored (it likely already is) |

**Note:** This plan is infrastructure-focused. There are no unit tests to write — verification is done by starting the stack and testing HTTP responses.

---

### Task 1: Custom Caddy Docker image

Create the Caddy Dockerfile with the DuckDNS DNS plugin for Let's Encrypt DNS-01 challenges.

**Files:**
- Create: `caddy/Dockerfile`

- [ ] **Step 1: Create `caddy/` directory and Dockerfile**

```dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

- [ ] **Step 2: Verify it builds**

Run: `docker build -t cng-caddy caddy/`
Expected: Image builds successfully. The `xcaddy build` step takes ~30-60 seconds.

- [ ] **Step 3: Commit**

```bash
git add caddy/Dockerfile
git commit -m "feat: add custom Caddy image with DuckDNS DNS plugin"
```

---

### Task 2: Caddyfile

Create the reverse proxy configuration.

**Files:**
- Create: `Caddyfile`

**Context:** Caddy uses environment variables via `{$VAR}` syntax. The `basic_auth` directive takes a username and a bcrypt hash. The `reverse_proxy` points to the Vite dev server which already handles all `/api`, `/raster`, `/vector`, `/pmtiles`, `/storage` routing internally.

- [ ] **Step 1: Create `Caddyfile` in project root**

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

**Important — bcrypt `$` escaping:** The `AUTH_PASSWORD_HASH` value contains `$` characters (e.g., `$2a$14$...`). In the `.env` file, these must be escaped as `$$` to prevent Docker Compose from interpreting them as variable references. For example, if the hash is `$2a$14$abc...`, write it as `$$2a$$14$$abc...` in `.env`. Caddy will receive the correct value after Docker Compose processes the double-dollar escaping.

- [ ] **Step 2: Commit**

```bash
git add Caddyfile
git commit -m "feat: add Caddyfile with TLS, basic auth, and gzip"
```

---

### Task 3: DuckDNS update script

Create the cron script that keeps the DNS record pointing to the VM's current IP.

**Files:**
- Create: `scripts/update-duckdns.sh`

**Context:** Cron jobs run in a minimal shell environment with no access to `.env` or exported variables. The subdomain and token must be hardcoded or passed as arguments. Since this file will be committed to the repo, use placeholder values that the user fills in on the VM.

- [ ] **Step 1: Create `scripts/update-duckdns.sh`**

```bash
#!/bin/bash
# Updates DuckDNS record with current public IP.
# Hardcode values here — cron has no access to .env.
# Run via: crontab -e
#   */5 * * * * /path/to/update-duckdns.sh >> /var/log/duckdns.log 2>&1

SUBDOMAIN="CHANGE_ME"
TOKEN="CHANGE_ME"

echo "$(date): $(curl -s "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=")"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/update-duckdns.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/update-duckdns.sh
git commit -m "feat: add DuckDNS IP update script for cron"
```

---

### Task 4: Docker Compose — add Caddy service and CORS fix

Add the Caddy service to `docker-compose.yml` with the `prod` profile, and update CORS origins on the ingestion service.

**Files:**
- Modify: `docker-compose.yml`

**Context:**
- The `profiles: [prod]` key means Caddy only starts with `docker compose --profile prod up`. Normal `docker compose up` is unchanged.
- `caddy_data` persists TLS certificates between restarts (important — Let's Encrypt has rate limits).
- `caddy_config` persists Caddy's runtime config.
- CORS_ORIGINS must include the production domain or browser fetch/upload requests will fail on preflight.

- [ ] **Step 1: Add Caddy service to `docker-compose.yml`**

Add this block after the `frontend` service definition (before `volumes:`):

```yaml
  caddy:
    build:
      context: caddy
    restart: unless-stopped
    profiles:
      - prod
    deploy:
      resources:
        limits:
          memory: 128M
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

- [ ] **Step 2: Add volumes**

Add `caddy_data:` and `caddy_config:` to the `volumes:` section at the bottom:

```yaml
volumes:
  pgdata:
  miniodata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: Update CORS_ORIGINS on the ingestion service**

Change the `CORS_ORIGINS` line in the `ingestion` service from:

```yaml
      CORS_ORIGINS: '["http://localhost:5185"]'
```

to:

```yaml
      CORS_ORIGINS: '["http://localhost:5185", "https://${SITE_ADDRESS:-localhost}"]'
```

This adds the production domain. When `SITE_ADDRESS` is not set (local dev), it adds `https://localhost` which is harmless.

- [ ] **Step 4: Verify local dev still works**

Run: `docker compose config --services`
Expected: Should list all existing services but NOT `caddy` (because it has `profiles: [prod]`).

Run: `docker compose --profile prod config --services`
Expected: Should list all services INCLUDING `caddy`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Caddy reverse proxy with prod profile and CORS fix"
```

---

### Task 5: Environment variables

Add deployment-related variables to `.env` and `.env.example`.

**Files:**
- Modify: `.env`
- Modify: `.env.example` (if it exists and differs from `.env`)

- [ ] **Step 1: Add deployment variables to `.env`**

Append to the end of `.env`:

```
# Deployment — only needed when running with: docker compose --profile prod up
# DuckDNS: sign up at https://www.duckdns.org and create a subdomain
SITE_ADDRESS=
DUCKDNS_TOKEN=
AUTH_USER=demo
AUTH_PASSWORD_HASH=
```

Leave `SITE_ADDRESS`, `DUCKDNS_TOKEN`, and `AUTH_PASSWORD_HASH` blank. These are filled in on the VM after DuckDNS setup.

- [ ] **Step 2: Update `.env.example` if it exists**

If `.env.example` exists and is a separate file from `.env`, add the same block.

- [ ] **Step 3: Verify `.env` is gitignored**

Run: `git check-ignore .env`
Expected: `.env` is listed (it's ignored). If NOT ignored, add `.env` to `.gitignore`.

Note: Since `.env` and `.env.example` currently have the same content and `.env` may not be gitignored, check whether `.env` is committed to the repo. If it is, the deployment variables (with blank values) are safe to commit since they contain no secrets. The actual secrets (token, password hash) are filled in only on the VM.

- [ ] **Step 4: Commit**

```bash
git add .env .env.example .gitignore 2>/dev/null
git commit -m "feat: add deployment env vars for Caddy and DuckDNS"
```

---

### Task 6: End-to-end verification (local)

Verify the full stack still works for local development and that the prod profile builds.

**Files:** None (verification only)

- [ ] **Step 1: Verify local dev is unaffected**

Run:
```bash
docker compose down
docker compose up -d --build
docker compose ps
```

Expected: All existing services start. No `caddy` container. Frontend accessible at `http://localhost:5185`.

Run: `curl -s http://localhost:5185/ | head -5`
Expected: HTML response (the React app's index.html).

Run: `curl -s http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 2: Verify prod profile builds**

Run: `docker compose --profile prod build caddy`
Expected: Caddy image builds successfully (the xcaddy step compiles the DuckDNS plugin).

- [ ] **Step 3: Verify prod profile starts Caddy (it will fail TLS without real DuckDNS, that's expected)**

Run: `docker compose --profile prod up -d caddy`
Expected: Caddy container starts. It will likely log TLS errors because `SITE_ADDRESS` is blank or `DUCKDNS_TOKEN` is not set. This is expected — we're just verifying the container starts and connects to the Docker network.

Run: `docker compose logs caddy --tail 20`
Expected: Caddy startup logs visible. May show DNS/TLS errors — that's fine for local verification.

- [ ] **Step 4: Clean up**

Run: `docker compose --profile prod stop caddy`

- [ ] **Step 5: Commit (if any fixes were needed)**

If any files required changes during verification, commit them.

---

### Task 7: VM deployment instructions

Document the manual steps needed on the Hetzner VM that can't be automated in code.

**Files:**
- Modify: `CLAUDE.md` (add a "Deployment" section)

- [ ] **Step 1: Add deployment section to CLAUDE.md**

Add a new section after "Local Deployment" titled "Production Deployment (Hetzner)":

```markdown
### Production Deployment (Hetzner)

The sandbox can be deployed to a public URL with HTTPS and basic auth using the `prod` Docker Compose profile.

#### Prerequisites

1. **DuckDNS subdomain:** Sign up at [duckdns.org](https://www.duckdns.org), create a subdomain, note the token
2. **Hetzner firewall:** Allow inbound TCP 22, 80, 443 only (block all other ports from external access)
3. **Generate a password hash:**
   ```bash
   docker run --rm caddy caddy hash-password --plaintext 'your-password'
   ```

#### Configure

1. Edit `.env` on the VM and fill in the deployment variables:
   ```
   SITE_ADDRESS=your-subdomain.duckdns.org
   DUCKDNS_TOKEN=your-token-here
   AUTH_USER=demo
   AUTH_PASSWORD_HASH=$$2a$$14$$... (escape $ as $$ for Docker Compose)
   ```

2. Edit `scripts/update-duckdns.sh` and set `SUBDOMAIN` and `TOKEN`

3. Add the cron job:
   ```bash
   crontab -e
   # Add: */5 * * * * /path/to/scripts/update-duckdns.sh >> /var/log/duckdns.log 2>&1
   ```

#### Start

```bash
docker compose --profile prod up -d --build
```

#### Verify

- Visit `https://your-subdomain.duckdns.org` — should prompt for username/password
- After auth, the sandbox should load normally
- Upload a file to verify CORS works end-to-end

#### Notes

- `docker compose up` (without `--profile prod`) still runs local dev without Caddy
- Backend service ports (8000, 8081-8083, 9000-9001) are accessible on localhost via SSH tunnel but blocked externally by the Hetzner firewall
- The `caddy_data` volume persists TLS certificates — don't delete it or you'll hit Let's Encrypt rate limits
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add production deployment instructions to CLAUDE.md"
```
