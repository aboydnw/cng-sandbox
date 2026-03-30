# CNG Sandbox

Self-hosted geospatial data conversion sandbox. Upload GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5 files and get back browseable raster/vector tile maps.

## Architecture

```
Browser → Frontend (Vite :5185) → /api proxy → Ingestion API (:8000)
                                → /raster proxy → titiler-pgstac (:80)
                                → /vector proxy → tipg (:80)

Ingestion API → Cloudflare R2 (S3-compatible object store)
              → pgSTAC (PostgreSQL + PostGIS + STAC)
              → STAC API (stac-fastapi-pgstac)
```

All services run in Docker. The frontend proxies all API and tiler requests through Vite's dev server, so the browser only talks to port 5185.

## Project Documentation

All project docs live in Obsidian at `~/Obsidian/Project Docs/CNG Sandbox/`. Start with `index.md` for a linked overview.

- `product/` — PRDs, product specs, competitive analysis, feature specs
- `architecture/` — system design, integration plans
- `research/` — technical investigations, conversion shootout results
- `specs/` — superpowers design specs (dated, paired with plans)
- `plans/` — superpowers implementation plans (dated, checkbox-tracked)
- `devlog/` — progress updates, test results, deployment notes

After pushing a branch and opening a PR for a significant feature or fix, write a devlog entry to `devlog/YYYY-MM-DD-<topic>.md` summarizing what was built, what diverged from the plan (if any), and lessons learned. Update `index.md` to link to it.

## Local Deployment

### Prerequisites

- Docker and Docker Compose
- No library build step required — the frontend vendors its own copies of the few utilities it needs

### Start the stack

```bash
# Start all services
docker compose -f docker-compose.yml up -d --build

# Verify all containers are healthy
docker compose -f docker-compose.yml ps
```

The frontend is available at `http://localhost:5185`.

### Stop the stack

```bash
docker compose -f docker-compose.yml down        # Stop containers
docker compose -f docker-compose.yml down -v     # Stop and delete volumes (wipes data)
```

### Rebuild a single service

```bash
docker compose -f docker-compose.yml build <service>
docker compose -f docker-compose.yml up -d <service>
```

Service names: `database`, `stac-api`, `raster-tiler`, `vector-tiler`, `ingestion`, `frontend`

## Production Deployment (Hetzner)

The sandbox can be deployed to a public URL with HTTPS and basic auth using the `prod` Docker Compose profile.

### Prerequisites

1. **Domain:** Point an A record for your domain (e.g. `cngsandbox.org`) to the Hetzner VM's public IPv4 address. Caddy auto-obtains Let's Encrypt certs via HTTP-01 challenge.
2. **Hetzner firewall:** Allow inbound TCP 22, 80, 443 only (block all other ports from external access). Configure in the Hetzner Cloud console (Firewalls section). Also check the OS-level firewall: `sudo ufw status` — if active, ensure ports 80 and 443 are allowed (`sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`)
3. **Generate a password hash:**
   ```bash
   docker run --rm caddy caddy hash-password --plaintext 'your-password'
   ```

### Configure

1. Edit `.env` on the VM and fill in the deployment variables:
   ```
   SITE_ADDRESS=cngsandbox.org
   AUTH_USER=demo
   AUTH_PASSWORD_HASH=$$2a$$14$$... (escape $ as $$ for Docker Compose)
   ```

### Start

```bash
docker compose --profile prod up -d --build
```

### Verify

- Visit `https://cngsandbox.org` — should prompt for username/password
- After auth, the sandbox should load normally
- Upload a file to verify CORS works end-to-end

### Notes

- `docker compose up` (without `--profile prod`) still runs local dev without Caddy
- Backend service ports (8000, 8081-8083) are accessible on localhost via SSH tunnel but blocked externally by the Hetzner firewall
- The `caddy_data` volume persists TLS certificates — don't delete it or you'll hit Let's Encrypt rate limits

## CI/CD

### Pull Requests

All changes go through PRs. Branch protection requires `backend`, `frontend`, `docker-build`, and `conventional-commits` CI jobs to pass before merge. PR titles must follow conventional commit format — this is enforced by the `conventional-commits` workflow.

### Releases

Releases are managed by [release-please](https://github.com/googleapis/release-please). It watches `main` for conventional commits (`feat:`, `fix:`, etc.) and maintains an open Release PR with a changelog and version bump.

**To release:** Merge the Release PR. This triggers auto-deploy to the Hetzner VM.

**Manual deploy:** Use the "Run workflow" button on the release-please workflow in GitHub Actions to deploy without creating a release.

**Version:** Tracked in `version.txt` (managed by release-please, don't edit manually).

### GitHub App for Release-Please (optional)

By default, release-please uses `GITHUB_TOKEN`, which means its PRs won't trigger CI checks (GitHub limitation). To fix this, set up a GitHub App:

1. Create a GitHub App in your account settings with permissions: Contents (write), Pull Requests (write), Metadata (read)
2. Install the app on the `cng-sandbox` repository
3. In repo Settings > Secrets and variables > Actions:
   - Add `RELEASE_BOT_ID` as a **variable** (the App ID)
   - Add `RELEASE_BOT_PRIVATE_KEY` as a **secret** (the private key PEM)

### Conventional Commits

All commits to `main` must use conventional prefixes:

| Prefix | Meaning | Version bump |
|--------|---------|-------------|
| `feat:` | New feature | minor (0.1.0 → 0.2.0) |
| `fix:` | Bug fix | patch (0.1.0 → 0.1.1) |
| `feat!:` or `fix!:` | Breaking change | major (0.1.0 → 1.0.0) |
| `chore:`, `docs:`, `refactor:` | Maintenance | no bump (appears in changelog) |

## Services and Ports

| Port | Service | Image |
|------|---------|-------|
| 5185 | Frontend (Vite dev server) | Local build |
| 8000 | Ingestion API (FastAPI) | Local build |
| 8081 | STAC API | stac-fastapi-pgstac 5.0.2 |
| 8082 | Raster tiler | titiler-pgstac 1.7.2 |
| 8083 | Vector tiler | tipg 1.0.1 |
| 5439 | PostgreSQL (pgSTAC) | pgstac 0.9.6 |

## Environment

All env vars are in `.env`. R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`) must be set before starting the stack.

## Networking: Internal vs Public URLs

This is the trickiest part of the stack. There are two URL contexts:

1. **Internal (server-to-server)**: Docker service names with container-internal ports. Used by the ingestion service to talk to tilers and STAC API.
   - `STAC_API_URL=http://stac-api:8080` (internal port, not 8081)
   - `RASTER_TILER_URL=http://raster-tiler:80` (internal port, not 8082)
   - `VECTOR_TILER_URL=http://vector-tiler:80` (internal port, not 8083)

2. **Public (browser-facing)**: Proxy paths that the browser uses. The ingestion API embeds these into dataset responses so the frontend knows where to fetch tiles.
   - `PUBLIC_RASTER_TILER_URL=/raster`
   - `PUBLIC_VECTOR_TILER_URL=/vector`

The frontend's Vite dev server proxies `/api` → ingestion, `/raster` → titiler, `/vector` → tipg. This is configured via server-side env vars (NOT `VITE_` prefixed):
- `API_PROXY_TARGET=http://ingestion:8000`
- `RASTER_TILER_PROXY_TARGET=http://raster-tiler:80`
- `VECTOR_TILER_PROXY_TARGET=http://vector-tiler:80`

**Key rule**: `VITE_*` env vars are baked into client-side JS at build time. Never set them to Docker-internal hostnames (like `http://ingestion:8000`) — the browser can't resolve those. Use empty strings and let the Vite proxy handle routing.

## Frontend

Built with React 19, Chakra UI v3, MapLibre GL JS (vector maps), and deck.gl (raster maps). A small set of vendored utilities from `@maptool/core` live in `src/lib/maptool/`.

### Running tests

```bash
cd frontend && npx vitest run
```

### Design direction

- **Icons over emojis**: Use [Phosphor Icons](https://phosphoricons.com/) (`@phosphor-icons/react`) for all UI icons. Never use emoji or custom SVG illustrations where a Phosphor icon exists. Keep icon usage consistent with the existing set (see imports across `src/components/`).
- **Brand palette**: Use the warm brand tokens (`brand.orange`, `brand.bgSubtle`, `brand.border`, `brand.brown`) for interactive states and accents. Avoid Chakra's default `blue.*` scale.

### Gotchas

- **MapLibre requires absolute tile URLs**: Vector tile sources must use `window.location.origin + path`, not relative paths. See `VectorMap.tsx`.
- **deck.gl handles relative URLs fine**: Raster tiles via `createCOGLayer`/`useTitiler` work with relative paths since deck.gl uses `fetch()` internally.
- **SSE named events**: The ingestion API sends `event: status` SSE events. The frontend must use `addEventListener("status", ...)`, not `onmessage` (which only handles unnamed events).
- **Vendored maptool utilities**: `src/lib/maptool/` contains `createCOGLayer`, `createPMTilesProtocol`, `useColorScale`, `MapLegend`, and `listColormaps` — vendored from `@maptool/core` so the sandbox has no external dependency on the library.

## Ingestion Service

Python FastAPI service. Source in `ingestion/src/`.

### Running tests

```bash
cd ingestion && uv run pytest -v
```

### Key endpoints

- `POST /api/upload` — Upload a file (multipart form)
- `POST /api/convert-url` — Fetch and convert a file from a URL
- `GET /api/jobs/{id}/stream` — SSE stream of conversion progress
- `GET /api/datasets` — List all converted datasets
- `GET /api/datasets/{id}` — Get dataset metadata (includes `tile_url`)
- `GET /api/health` — Health check

### Conversion pipeline

1. **Upload/fetch** → save raw file
2. **Scan** → detect file type, validate
3. **Convert** → GeoTIFF→COG, GeoJSON/Shapefile→GeoParquet, NetCDF→COG, HDF5→COG
4. **Store** → COGs to Cloudflare R2, vectors to PostgreSQL
5. **Register** → COGs registered in pgSTAC, vectors available via tipg
6. **Ready** → tile URL returned to frontend

### tipg (vector tiler) notes

- `TIPG_CATALOG_TTL=5` — refresh interval (seconds) for discovering new PostgreSQL tables. Default is 300s which causes long delays.
- Source-layer name in MVT tiles is always `"default"`, not the table name.
- Collection IDs use the `public.` schema prefix (e.g., `public.sandbox_abc123`).

### titiler-pgstac (raster tiler) notes

- Uses GDAL internally. GDAL < 3.11 requires `AWS_S3_ENDPOINT` (hostname:port without protocol) for S3 access, in addition to `AWS_ENDPOINT_URL`.
- `AWS_VIRTUAL_HOSTING=FALSE` is required for R2 (path-style access).

## Skill Feedback Loop

When fixing bugs discovered during integration testing or E2E validation, **always propagate fixes back to the relevant conversion skills** in `geo-conversions/`. This is a core part of the validation/QA value of those skills.

### What to update

1. **Validation scripts** (`scripts/validate.py`): Add new `CheckResult` checks that would catch the issue. These checks serve as regression tests for future conversions.
2. **SKILL.md Known failure modes**: Document the failure with root cause and fix, so future agents don't repeat the same mistakes.
3. **SKILL.md Changelog**: Record the date and what was added.

### When to do it

After fixing any bug in the sandbox ingestion pipeline that relates to data format conversion or downstream compatibility (e.g., column naming, CRS handling, file structure). If the bug would have been caught by a smarter validation script, add that check.
