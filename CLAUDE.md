# CNG Sandbox

Self-hosted geospatial data conversion sandbox. Upload GeoTIFF, GeoJSON, Shapefile, CSV/TSV, NetCDF, HDF5, LAS/LAZ, or GPX files and get back browseable raster/vector tile maps, streamed point clouds, and animated movement tracks.

## Architecture

```
Browser → Frontend (Vite :5185) → /api proxy → Ingestion API (:8086)
                                → /cog proxy → COG tiler (:8084)
                                → /raster proxy → titiler-pgstac (:80)
                                → /vector proxy → tipg (:80)

Ingestion API → Cloudflare R2 (S3-compatible object store)
              → pgSTAC (PostgreSQL + PostGIS + STAC)
              → STAC API (stac-fastapi-pgstac)
```

All services run in Docker. The frontend proxies all API and tiler requests through Vite's dev server, so the browser only talks to port 5185.

## Reference docs (load on demand)

Dense reference material lives under [docs/](docs/) and should be read only when the task touches that area:

- [docs/frontend-gotchas.md](docs/frontend-gotchas.md) — tile URLs, client-side COG rendering, EPSG resolver, pixel inspector, snapshots, GeoParquet, Chakra v3, analytics, portable story config (iframe embeds), zarr connections. Read before touching `frontend/src/`.
- [docs/api-reference.md](docs/api-reference.md) — full ingestion API surface. Read before adding/changing any `/api/*` endpoint or frontend-backend contract.
- [docs/production-deployment.md](docs/production-deployment.md) — Hetzner deploy, CSP, tile caching. Read before prod changes.
- [docs/cicd.md](docs/cicd.md) — release-please, Dependabot, conventional-commit enforcement. Read before touching workflows.
- [docs/example-data.md](docs/example-data.md) — `is_example` datasets/stories/connections, source.coop seeding. Read before touching `src/services/example_*.py`.
- [docs/services.md](docs/services.md) — tipg/titiler-pgstac notes, GDAL+R2 env vars. Read before editing tiler env-vars in `docker-compose.yml` or debugging tile-rendering S3/GDAL config issues.
- [docs/context-layers.md](docs/context-layers.md) — building/uploading admin-boundary overlay PMTiles (tippecanoe → R2) that seed as example "context layer" connections for story overlays. Read before touching the admin-boundary `EXAMPLE_CONNECTIONS` seeds or the overlay data-prep pipeline.

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

Service names: `database`, `stac-api`, `raster-tiler`, `vector-tiler`, `cog-tiler`, `ingestion`, `frontend`

## Production Deployment

Deployed to Hetzner via the `prod` Docker Compose profile, with Caddy providing HTTPS. The whole site is public (no basic-auth gate). Full deploy steps, CSP rules, and tile caching are in [docs/production-deployment.md](docs/production-deployment.md) — read before any prod change.

## CI/CD

PRs require `backend`, `frontend`, `archive-runtime`, `docker-build`, and `conventional-commits` jobs to pass. Releases are automated via release-please (merge the open Release PR to cut a version and auto-deploy). Dependabot opens weekly grouped PRs. Full details (release-please GitHub App setup, dependency-update workflow, conventional-commit table) are in [docs/cicd.md](docs/cicd.md).

## Services and Ports

| Port | Service | Image |
|------|---------|-------|
| 5185 | Frontend (Vite dev server) | Local build |
| 8084 | COG tiler | titiler 0.19.1 |
| 8086 | Ingestion API (FastAPI) | Local build |
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

The frontend's Vite dev server proxies `/api` → ingestion, `/cog` → COG tiler, `/raster` → titiler-pgstac, `/vector` → tipg. This is configured via server-side env vars (NOT `VITE_` prefixed):
- `API_PROXY_TARGET=http://ingestion:8000` (internal container port; host-mapped to 8086)
- `COG_TILER_PROXY_TARGET=http://cog-tiler:80`
- `RASTER_TILER_PROXY_TARGET=http://raster-tiler:80`
- `VECTOR_TILER_PROXY_TARGET=http://vector-tiler:80`

**Key rule**: `VITE_*` env vars are baked into client-side JS at build time. Never set them to Docker-internal hostnames (like `http://ingestion:8000`) — the browser can't resolve those. Note: internal container ports (like 8000) differ from host-mapped ports (like 8086). Use empty strings and let the Vite proxy handle routing.

## Frontend

Built with React 19, Chakra UI v3, MapLibre GL JS, and deck.gl. `UnifiedMap` composites the two: a `react-map-gl/maplibre` map is the root and owns the camera and basemap, and deck.gl draws raster/vector layers on top via a `MapboxOverlay` (`@deck.gl/mapbox`). A small set of vendored utilities from `@maptool/core` live in `src/lib/maptool/`. COPC point clouds are the exception to the deck.gl path: they render through a `maplibre-gl-lidar` `LidarControl` mounted directly on the MapLibre root (via the `useCopcLayer` hook), streaming the `.copc.laz` over HTTP range requests — not through deck.gl or a tiler. GPX trajectories stay on the deck.gl path but animate over time: `src/lib/layers/tripsLayer.ts` builds a `TripsLayer` (speed-colored, fading trail) driven by the `useTripsLayer`/`useTripsAnimation` hooks and a continuous-time transport bar (`TrajectoryControls`), fed by the `trips.json` sidecar. Story map chapters can also embed these animated tracks (`useStoryTripsTracks`), and they carry through the archival/interactive exports. See [docs/frontend-gotchas.md](docs/frontend-gotchas.md).

A separate Vite library workspace at `frontend/archive-runtime/` builds the interactive-export runtime (a single `bundle.js` + `bundle.css`) that the ingestion service embeds into archival HTML exports. The ingestion Dockerfile builds this bundle in a dedicated stage and copies it to `/app/runtime_assets`; `ingestion/src/services/interactive_export/html_shell.py` emits a real shell loading the bundle when it's available.

A reader-facing "Ask this map" chat agent lives in `src/lib/chat/` (conversation loop, SSE client, and 8 `zod`-validated client-side tools that drive the map) and `src/components/chat/` (panel + entry button). It streams from the ingestion `/api/chat` SSE relay and is gated on `GET /api/chat/config`; the backend never executes tools — they run in the browser. See the chat endpoints in [docs/api-reference.md](docs/api-reference.md).

### Running tests

```bash
cd frontend && npx vitest run
cd frontend/archive-runtime && yarn test    # archive-runtime workspace
```

### Design direction

- **Icons over emojis**: Use [Phosphor Icons](https://phosphoricons.com/) (`@phosphor-icons/react`) for all UI icons. Never use emoji or custom SVG illustrations where a Phosphor icon exists. Keep icon usage consistent with the existing set (see imports across `src/components/`).
- **Brand palette**: Use the warm brand tokens (`brand.orange`, `brand.bgSubtle`, `brand.border`, `brand.brown`) for interactive states and accents. Avoid Chakra's default `blue.*` scale.

### Implementation gotchas

Non-obvious behaviors (tile URL absolute-vs-relative, client-side COG rendering pipeline, pixel inspector tooltip modes, Chakra v3 Portal requirement, Plausible CSP coupling, viewer build target, static-bundle export, archival HTML export, iframe embeds, chart range persistence, zarr connections, etc.) are catalogued in [docs/frontend-gotchas.md](docs/frontend-gotchas.md). Read before editing anything in `frontend/src/lib/layers/`, `frontend/src/hooks/`, `frontend/src/lib/zarr/`, or the map/story components.

## Ingestion Service

Python FastAPI service. Source in `ingestion/src/`.

### Running tests

```bash
cd ingestion && uv run pytest -v
```

### API endpoints

Full endpoint catalog (uploads, jobs, datasets, stories, connections, remote discovery, misc) is in [docs/api-reference.md](docs/api-reference.md). Read before adding or modifying any `/api/*` route.

### Example datasets, stories, and connections

On startup, background tasks seed curated example `is_example=True` datasets/stories — mostly source.coop products, plus a pre-built white-stork GPS trajectory dataset and its "A stork's year" story (source/attribution in `src/services/example_trajectory_source.py`; the `trips.json`/GeoParquet artifacts are converted out of band and seeded to point at them, not converted on startup). A parallel task seeds `is_example=True` connections from the `EXAMPLE_CONNECTIONS` list in `src/services/example_connections.py`; this list currently ships five entries (IMERG Final Precipitation and Fields of The World zarrs, the Autzen Stadium COPC point cloud, and two admin-boundary PMTiles "context layers" — countries and states/provinces — used as story overlays; see [docs/context-layers.md](docs/context-layers.md)). These `is_example` rows are a **master set** owned by no workspace; they are no longer surfaced directly in `GET /api/datasets|stories|connections`. Instead each workspace gets its own editable clones (`is_example_copy=True`) via `src/services/example_workspace.py`, seeded/removed/reported through `POST/DELETE/GET /api/workspaces/{id}/examples`. Details and idempotency rules: [docs/example-data.md](docs/example-data.md).

### Conversion pipeline

1. **Upload/fetch** → save raw file
2. **Scan** → detect file type, validate; for rasters also runs categorical detection (color table → RAT → heuristic); CSV/TSV pauses for a geometry-column mapping (lat/lon or WKT), reusing the same scan→pause→resume machinery as NetCDF/HDF5 variable selection
3. **Convert** → GeoTIFF→COG, GeoJSON/Shapefile→GeoParquet, CSV/TSV→GeoParquet (geometry-column mapping, null-geometry rows dropped), NetCDF→COG, HDF5→COG, LAS/LAZ→COPC (PDAL), GPX→GeoParquet + `trips.json` sidecar (MovingPandas)
4. **Store** → COGs to Cloudflare R2, vectors to PostgreSQL, COPC point clouds and trajectory GeoParquet/`trips.json` to R2
5. **Register** → COGs registered in pgSTAC, vectors available via tipg
6. **Ready** → tile URL returned to frontend

LAS/LAZ point clouds take a separate branch (`src/services/pointcloud_pipeline.py`): they are converted to COPC with PDAL and stored to R2, but are **not** registered in pgSTAC or tipg — the browser streams the `.copc.laz` directly via HTTP range requests, so no tiler is in the loop. See [docs/services.md](docs/services.md) (PDAL) and [docs/api-reference.md](docs/api-reference.md) for details.

GPX trajectories take their own parallel branch (`src/services/trajectory_pipeline.py`): MovingPandas parses the track points into cleaned trajectories, writes a canonical GeoParquet plus a browser-ready `trips.json` sidecar (per-track path, epoch-ms timestamps, and speeds), and stores both to R2. Like COPC, they are **not** registered in pgSTAC or tipg — the frontend fetches `trips.json` directly and animates it with a deck.gl `TripsLayer`. GPX must carry per-point timestamps; points are capped at 2M per dataset.

### Tiler service notes

For tipg, titiler-pgstac, and GDAL+R2 env-var configuration, see [docs/services.md](docs/services.md).

## MCP Server

Wraps the ingestion API as MCP tools (datasets, stories, connections, validation, plus ingestion & export: job polling, URL ingest, remote temporal/mosaic discovery+connect, story-asset upload, connection colormap/categories/delete, interactive HTML export) for Claude Desktop/Code. Source in `mcp/src/cng_mcp/`. See [mcp/README.md](mcp/README.md) for tools, resources, server config, and client examples.

### Running tests

```bash
cd mcp && uv run pytest -v
```

## Agent Isolation & Worktrees

All code changes happen in worktrees. The main session stays on `main` at all times.

### Worktree directory

Worktrees live in `.worktrees/` (already gitignored).

### Lifecycle

1. **Start work**: Create a worktree and branch at the beginning of every issue or feature. All code changes, commits, and pushes happen inside this worktree.
   ```bash
   git worktree add .worktrees/<branch-name> -b <branch-name>
   ```
2. **Open PR**: Push from the worktree and create the PR.
3. **Monitor PR**: The monitoring loop runs in the main session (read-only `gh` commands, no isolation needed).
4. **Fix review feedback**: When the monitoring loop detects feedback that needs code changes, spawn a subagent that works in the **existing worktree** — not a new one. Pass the worktree path so the subagent can `cd` into it, make fixes, commit, and push.
5. **Post-merge cleanup**: After the PR is squash-merged, clean up from the main session:
   ```bash
   git worktree remove .worktrees/<branch-name>
   git branch -D <branch-name>
   ```

### Rules

- Never `git checkout` a feature branch in the main session. If you need to change code, do it in the worktree.
- One worktree per branch. Multiple agents can work on different issues simultaneously without conflicts.
- The monitoring loop must pass the worktree path when dispatching fix subagents so they reuse the same worktree and branch.
- **Never touch the prod Docker stack.** Do not run `docker compose up`, `docker compose down`, or `docker compose build` against the default project. The prod stack serves live users and must not be disrupted by development work.

### Visual testing with Docker

When you need to test changes that require the full Docker stack (backend, tilers, database), use the **worktree stack** — an isolated compose stack with offset ports that runs alongside prod:

```bash
# From inside a worktree directory:
scripts/worktree-stack.sh up              # Start (infers branch name from git)
scripts/worktree-stack.sh down            # Stop and remove volumes
scripts/worktree-stack.sh ps              # Check status
scripts/worktree-stack.sh logs ingestion  # Tail a service's logs
```

| Service | Prod port | Worktree port |
|---------|-----------|---------------|
| Frontend | 5185 | 5285 |
| Ingestion API | 8086 | 8186 |
| STAC API | 8081 | 8181 |
| Raster tiler | 8082 | 8182 |
| Vector tiler | 8083 | 8183 |
| COG tiler | 8084 | 8184 |
| PostgreSQL | 5439 | 5539 |

The worktree stack gets its own containers, network, and database volume (via the `-p` project name). Use `down` (not just `stop`) when done to free resources — it removes volumes too.

For **frontend-only changes**, you can skip Docker entirely and just run `cd frontend && npx vite dev --port 5285` — this uses the prod backend services through the Vite proxy.

## Skill Feedback Loop

When fixing bugs discovered during integration testing or E2E validation, **always propagate fixes back to the relevant conversion skills** in `geo-conversions/`. This is a core part of the validation/QA value of those skills.

### What to update

1. **Validation scripts** (`scripts/validate.py`): Add new `CheckResult` checks that would catch the issue. These checks serve as regression tests for future conversions.
2. **SKILL.md Known failure modes**: Document the failure with root cause and fix, so future agents don't repeat the same mistakes.
3. **SKILL.md Changelog**: Record the date and what was added.

### When to do it

After fixing any bug in the sandbox ingestion pipeline that relates to data format conversion or downstream compatibility (e.g., column naming, CRS handling, file structure). If the bug would have been caught by a smarter validation script, add that check.
