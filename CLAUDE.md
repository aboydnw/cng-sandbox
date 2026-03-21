# CNG Sandbox

Self-hosted geospatial data conversion sandbox. Upload GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5 files and get back browseable raster/vector tile maps.

## Architecture

```
Browser → Frontend (Vite :5185) → /api proxy → Ingestion API (:8000)
                                → /raster proxy → titiler-pgstac (:80)
                                → /vector proxy → tipg (:80)

Ingestion API → MinIO (S3-compatible object store)
              → pgSTAC (PostgreSQL + PostGIS + STAC)
              → STAC API (stac-fastapi-pgstac)
```

All services run in Docker. The frontend proxies all API and tiler requests through Vite's dev server, so the browser only talks to port 5185.

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

Service names: `database`, `stac-api`, `raster-tiler`, `vector-tiler`, `minio`, `minio-init`, `ingestion`, `frontend`

## Production Deployment (Hetzner)

The sandbox can be deployed to a public URL with HTTPS and basic auth using the `prod` Docker Compose profile.

### Prerequisites

1. **DuckDNS subdomain:** Sign up at [duckdns.org](https://www.duckdns.org), create a subdomain, note the token
2. **Hetzner firewall:** Allow inbound TCP 22, 80, 443 only (block all other ports from external access). Configure in the Hetzner Cloud console (Firewalls section). Also check the OS-level firewall: `sudo ufw status` — if active, ensure ports 80 and 443 are allowed (`sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`)
3. **Generate a password hash:**
   ```bash
   docker run --rm caddy caddy hash-password --plaintext 'your-password'
   ```

### Configure

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

### Start

```bash
docker compose --profile prod up -d --build
```

### Verify

- Visit `https://your-subdomain.duckdns.org` — should prompt for username/password
- After auth, the sandbox should load normally
- Upload a file to verify CORS works end-to-end

### Notes

- `docker compose up` (without `--profile prod`) still runs local dev without Caddy
- Backend service ports (8000, 8081-8083, 9000-9001) are accessible on localhost via SSH tunnel but blocked externally by the Hetzner firewall
- The `caddy_data` volume persists TLS certificates — don't delete it or you'll hit Let's Encrypt rate limits

## Services and Ports

| Port | Service | Image |
|------|---------|-------|
| 5185 | Frontend (Vite dev server) | Local build |
| 8000 | Ingestion API (FastAPI) | Local build |
| 8081 | STAC API | stac-fastapi-pgstac 5.0.2 |
| 8082 | Raster tiler | titiler-pgstac 1.7.2 |
| 8083 | Vector tiler | tipg 1.0.1 |
| 5439 | PostgreSQL (pgSTAC) | pgstac 0.9.6 |
| 9000 | MinIO S3 API | minio latest |
| 9001 | MinIO Console | minio latest |

## Environment

All env vars are in `.env`. Defaults work out of the box for local development.

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
4. **Store** → COGs to MinIO S3, vectors to PostgreSQL
5. **Register** → COGs registered in pgSTAC, vectors available via tipg
6. **Ready** → tile URL returned to frontend

### tipg (vector tiler) notes

- `TIPG_CATALOG_TTL=5` — refresh interval (seconds) for discovering new PostgreSQL tables. Default is 300s which causes long delays.
- Source-layer name in MVT tiles is always `"default"`, not the table name.
- Collection IDs use the `public.` schema prefix (e.g., `public.sandbox_abc123`).

### titiler-pgstac (raster tiler) notes

- Uses GDAL internally. GDAL < 3.11 requires `AWS_S3_ENDPOINT` (hostname:port without protocol) for S3 access, in addition to `AWS_ENDPOINT_URL`.
- `AWS_VIRTUAL_HOSTING=FALSE` is required for MinIO (path-style access).

## Skill Feedback Loop

When fixing bugs discovered during integration testing or E2E validation, **always propagate fixes back to the relevant conversion skills** in `geo-conversions/`. This is a core part of the validation/QA value of those skills.

### What to update

1. **Validation scripts** (`scripts/validate.py`): Add new `CheckResult` checks that would catch the issue. These checks serve as regression tests for future conversions.
2. **SKILL.md Known failure modes**: Document the failure with root cause and fix, so future agents don't repeat the same mistakes.
3. **SKILL.md Changelog**: Record the date and what was added.

### When to do it

After fixing any bug in the sandbox ingestion pipeline that relates to data format conversion or downstream compatibility (e.g., column naming, CRS handling, file structure). If the bug would have been caught by a smarter validation script, add that check.
