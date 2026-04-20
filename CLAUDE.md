# CNG Sandbox

Self-hosted geospatial data conversion sandbox. Upload GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5 files and get back browseable raster/vector tile maps.

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

## Production Deployment (Hetzner)

The sandbox can be deployed to a public URL with HTTPS using the `prod` Docker Compose profile. The frontend and shared `/map` / `/story` views are public; write operations and workspace listings are gated behind HTTP basic auth via Caddy.

### Auth model

Caddy applies basic auth selectively (see `Caddyfile`):

- **Public (no auth):** frontend SPA, `/storage/*` (R2 proxy), `/cog/*`, `/raster/*`, `/vector/*`, individual resource reads like `GET /api/datasets/{id}`, `GET /api/connections/{id}`, `GET /api/stories/{id}`, `/api/proxy`, `/api/health`. This lets shared map/story URLs load for anyone without a password prompt, and lets PMTiles / DuckDB-WASM range requests succeed (they can't send basic auth).
- **Auth required:** all non-GET/HEAD requests to `/api/*` (uploads, creates, updates, deletes) and workspace-listing reads (`GET /api/datasets`, `GET /api/connections`, `GET /api/stories`).

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

- Visit `https://cngsandbox.org` — the SPA should load without a password prompt
- Attempt an authenticated action (e.g. opening the dataset library or uploading a file) — should prompt for username/password
- Upload a file to verify CORS works end-to-end

### Notes

- `docker compose up` (without `--profile prod`) still runs local dev without Caddy
- Backend service ports (8081-8086) are accessible on localhost via SSH tunnel but blocked externally by the Hetzner firewall
- The `caddy_data` volume persists TLS certificates — don't delete it or you'll hit Let's Encrypt rate limits
- Caddy applies baseline security headers to every response (HSTS, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). The CSP allows `'wasm-unsafe-eval'` for DuckDB-WASM and is permissive on `connect-src`/`img-src` to accommodate user-supplied tile URLs and the CARTO basemap
- Tile responses (`/cog/*`, `/raster/*`, `/vector/*`) are served with `Cache-Control: public, max-age=3600`. Tile URLs are immutable per dataset (a change to the underlying data produces a new STAC item id or query param), so a 1-hour browser cache is safe and reduces Hetzner egress

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
- **COG tiler proxy preserves `/cog` prefix**: Unlike `/raster` and `/vector` (which strip their prefix before forwarding), the `/cog` proxy passes the path through unchanged because titiler's COG routes are already mounted under `/cog/`.
- **Vendored maptool utilities**: `src/lib/maptool/` contains `createCOGLayer`, `createPMTilesProtocol`, `useColorScale`, `MapLegend`, and `listColormaps` — vendored from `@maptool/core` so the sandbox has no external dependency on the library.
- **Categorical rasters use a JSON colormap, not `colormap_name`**: When a dataset has `isCategorical: true`, tile URLs are built with `colormap=<encoded-JSON>` (a `{value: [r,g,b]}` map) and `resampling=nearest` instead of the usual `colormap_name=` parameter. Mixing them will produce incorrect or broken tiles.
- **Client-side COG rendering is the default when eligible**: Eligibility is centralized in `evaluateClientRenderEligibility` (`src/lib/layers/clientRenderEligibility.ts`). A COG item is eligible if it has a `cogUrl`, valid `bounds` within ±85.05° latitude, is not temporal, has a CRS that is either unknown or Web Mercator (EPSG:3857, 900913, 3785), and has a file size within the browser cap (paletted: 2 GB; continuous: 500 MB). The CRS gate exists because the client COG renderer builds a mesh in the COG's native CRS and lets deck.gl's Mercator viewport warp it — only Web Mercator sources warp without visible error at zoom-out, so non-Mercator COGs must fall back to server-side reprojection. `MapItem.crs` is populated from `dataset.crs` for datasets and left `null` for connections (so connections skip the CRS check and remain eligible). `useMapControls` calls the helper on mount to decide the initial `renderMode`: eligible items default to `"client"`; ineligible items (temporal datasets, items missing bounds, non-Mercator CRS, oversized files, connections with unknown file size) default to `"server"`. The user can manually switch modes, and the choice is persisted to localStorage via `useRasterOverrides` alongside colormap and rescale settings — so returning to the same item restores the previous render mode. Layer construction is centralized in `resolveRasterLayers` (`src/lib/layers/resolveRasterLayers.ts`), which both `useLayerBuilder` (for `MapPage`) and `buildLayersForChapter` (for the story reader/editor) delegate to. `resolveRasterLayers` re-checks eligibility, then calls `classifyCogRenderPath` (`src/lib/layers/cogDtype.ts`) on the source's `dtype` + `isCategorical` flag. `uint8`/`int8` or any integer dtype flagged categorical → `buildCogLayerPaletted`. When categories are supplied, the paletted builder runs a LUT-driven shader pipeline (`CreateTexture` + `Colormap` modules) using a 256-entry RGBA LUT from `buildCategoricalLut` (`src/lib/layers/categoricalLut.ts`), caches the raw integer tile values for the pixel inspector, and respects user-edited category colors; without categories it falls back to the library default pipeline (honours the file's color table). Everything else → `buildCogLayerContinuous` (float32 → uint8 normalization + viridis colorize shader, caches raw tile data for the pixel inspector). For connections without a stored rescale, the continuous builder falls back to `[0, 1]` (see `parseRescaleString` in `src/lib/connections/rescale.ts`). The cap logic reads `converted_file_size` for datasets and `file_size` for connections. Changing the classifier rules only requires updating `evaluateClientRenderEligibility` and/or `resolveRasterLayers` — both call sites pick up the new behavior automatically.
- **Render mode is surfaced in every map view**: `RenderModeIndicator` (`src/components/RenderModeIndicator.tsx`) is an info button in the top-right of the map that reveals the active render mode and why, so users can see whether a layer is rendering client-side or falling back to server tiles. `MapPage` renders it next to `SnapButton` for raster items, pulling eligibility via `evaluateClientRenderEligibility(item)` and the size from `dataset.converted_file_size` / `connection.file_size`. Stories use the same component: `buildLayersForChapter` returns `{layers, renderMetadata}` where `renderMetadata` carries `{renderMode, reason, sizeBytes}`, and `StoryRenderer` / `StoryEditorPage` render the indicator from that metadata. The indicator carries `data-snapshot-overlay` so it's included in map snapshots.
- **Pixel inspector has two tooltip modes**: `usePixelInspector` (`src/components/PixelInspector.tsx`) reads from the shared `tileCacheRef` populated by both client-render builders and returns a discriminated `hoverInfo` union. When the active layer is categorical *and* the user is in client render mode, `MapPage` passes the effective categories to the hook, which matches the looked-up value against the category list and emits a `{kind: "categorical"}` tooltip (color swatch + label via `CategoricalPixelTooltip`). Otherwise it emits a `{kind: "numeric"}` tooltip (formatted value + coord via `PixelInspectorTooltip`). Both tooltips are rendered in `MapPage` and gated on `renderMode === "client"`.
- **COG URL resolution handles dataset and connection sources**: `resolveCogUrl` in `src/lib/layers/cogLayer.ts` passes absolute `http(s)://` URLs through unchanged (external COG connections) and prefixes `window.location.origin` onto relative paths (dataset COGs served through the Vite proxy). Both client-side builders route their COG URL through this helper before handing it to the deck.gl COG layer.
- **Map snapshot composites WebGL canvases + DOM overlays**: `useMapSnapshot` (`src/hooks/useMapSnapshot.ts`) renders the MapLibre basemap canvas and the deck.gl canvas onto an off-screen `<canvas>`, then uses `html-to-image` to rasterize any elements marked `data-snapshot-overlay` (e.g. the map legend) and composites them at their correct positions. The output is downloaded as a PNG. Elements that should appear in snapshots must carry the `data-snapshot-overlay` attribute.
- **GeoParquet connections support two render paths**: `render_path: "client"` loads the file into DuckDB-WASM via `useGeoParquetRender`, returns an Arrow `Table`, and renders via deck.gl (500k feature cap). `render_path: "server"` triggers a background conversion (tippecanoe → PMTiles → R2); the frontend `useConnectionConversion` hook subscribes via EventSource (SSE) to `GET /api/connections/{id}/stream` and shows a conversion overlay on `MapPage` until the job finishes and a `tile_url` is available. When `render_path` is omitted, the server infers it: files over 50 MB default to `"server"`, smaller files default to `"client"`. The frontend also runs `pickRenderPath` (size + 500k feature threshold) to pre-select the path before submitting the connection.
- **Chakra v3 dialogs need Portal + DialogPositioner**: `Dialog.Content` must be wrapped in `<Portal><Dialog.Positioner>...</Dialog.Positioner></Portal>` to render as a fixed-position centered modal. Without them, content renders inline at its JSX-tree location (e.g. squished inside a flex header). See `ShareDialog.tsx`, `PublishDialog.tsx`, `UploadModal.tsx`, `GeoParquetPreviewModal.tsx` for the canonical pattern.

## Ingestion Service

Python FastAPI service. Source in `ingestion/src/`.

### Running tests

```bash
cd ingestion && uv run pytest -v
```

### Key endpoints

**Upload & conversion:**
- `POST /api/upload` — Upload a file (multipart form); returns 409 with `{"detail": "duplicate_dataset", "dataset_id": ..., "filename": ...}` if a file with the same name already exists in the workspace
- `POST /api/convert-url` — Fetch and convert a file from a URL; same 409 duplicate response as above
- `GET /api/check-duplicate?filename=<name>` — Preflight duplicate check; returns 409 if a dataset with that filename exists, or `{"duplicate": false}` if not
- `POST /api/check-format` — Pre-upload format validation; accepts a file chunk and filename, returns `{"valid": true}` or `{"valid": false, "error": "..."}`
- `POST /api/upload-temporal` — Upload multiple raster files as a time series (2–50 files, same format)
- `POST /api/scan/{scan_id}/convert` — Trigger conversion after a scan completes

**Jobs:**
- `GET /api/jobs/{id}` — Get job status
- `GET /api/jobs/{id}/stream` — SSE stream of conversion progress

**Datasets:**
- `GET /api/datasets` — List datasets belonging to the caller's workspace plus any dataset flagged `is_example=True` (example datasets are visible to every workspace)
- `GET /api/datasets/{id}` — Get dataset metadata (includes `tile_url`, `is_example`, and `is_shared`); returns 404 if the caller's workspace does not own the dataset and the dataset is not an example, not explicitly shared, and not referenced by a published story
- `PATCH /api/datasets/{id}` — Update editable dataset metadata (currently just `title`, 1–200 chars; pass `null` to clear); returns 403 if the dataset is an example or belongs to another workspace
- `PATCH /api/datasets/{id}/share` — Toggle public sharing; body `{"is_shared": true|false}`; returns 403 if the dataset is an example or belongs to another workspace
- `DELETE /api/datasets/{id}` — Delete a dataset; returns 403 if the dataset is an example (`is_example=True`) or belongs to another workspace
- `PATCH /api/datasets/{id}/categories` — Update category labels and/or colors for a categorical raster; body is a list of `{"value": int, "label"?: str, "color"?: "#RRGGBB"}` objects (each entry must include at least one of `label` or `color`); the first color override snapshots the prior color into `defaultColor` so the UI can offer a reset; returns 400 if dataset is not categorical or a value doesn't exist, 403 if the dataset is an example
- `POST /api/datasets/{id}/mark-categorical` — Promote a non-categorical integer raster to categorical by scanning unique values and assigning default colors from the qualitative palette; returns 400 if values can't be extracted (unsupported dtype or too many unique values), 403 if the dataset is an example or belongs to another workspace

**Stories (shareable map narratives):**
- `POST /api/stories` — Create a story with chapters linking to datasets
- `GET /api/stories` — List stories in the workspace
- `GET /api/stories/{id}` — Get a story by ID
- `PATCH /api/stories/{id}` — Update a story
- `DELETE /api/stories/{id}` — Delete a story

**Connections (external tile sources):**
- `GET /api/connections` — List connections in the workspace
- `POST /api/connections` — Register an external data source (XYZ raster/vector, COG, PMTiles, GeoParquet); COG connections automatically run categorical detection and persist `is_categorical` + `categories` on the connection row. GeoParquet connections support two render paths via the optional `render_path` field: `"client"` (DuckDB-WASM) or `"server"` (tippecanoe → PMTiles → R2, async background job). When omitted, the server infers the path by issuing a HEAD request for the file size: files over 50 MB → `"server"`, otherwise → `"client"`.
- `GET /api/connections/{id}/stream` — SSE stream of server-side conversion progress for a GeoParquet connection; emits `event: status` events with `{status, tile_url, error, feature_count}`; no workspace auth on this endpoint (EventSource cannot send custom headers); connection UUIDs are the only access barrier — a scoped auth token or cookie-based workspace auth would be more robust for production
- `GET /api/connections/{id}` — Get a connection by ID; returns 404 if the caller's workspace does not own the connection and it is not explicitly shared or referenced by a published story
- `PATCH /api/connections/{id}/share` — Toggle public sharing; body `{"is_shared": true|false}`; returns 403 if the connection belongs to another workspace
- `PATCH /api/connections/{id}/categories` — Update category labels and/or colors for a categorical COG connection; body is a list of `{"value": int, "label"?: str, "color"?: "#RRGGBB"}` objects (each entry must include at least one of `label` or `color`); the first color override snapshots the prior color into `defaultColor`; returns 400 if connection is not categorical or a value doesn't exist
- `DELETE /api/connections/{id}` — Delete a connection

**Remote data discovery:**
- `POST /api/discover` — Discover geospatial files at a URL or S3 prefix
- `POST /api/connect-remote` — Connect remote files as a mosaic or temporal dataset
- `POST /api/connect-source-coop` — Register a curated source.coop product as a zero-copy pgSTAC collection (v1 products: `ausantarctic/ghrsst-mur-v2`, `alexgleith/gebco-2024`, `vizzuality/lg-land-carbon-data`, `vida/google-microsoft-osm-open-buildings`). Raster products (`kind="mosaic"`) run a STAC/path enumerator and register as pgSTAC mosaics; PMTiles products (`kind="pmtiles"`) read the remote PMTiles v3 header for bounds/zoom and register as a `FormatPair.PMTILES` vector dataset pointing at the source URL.

**Other:**
- `POST /api/bug-report` — Submit a bug report (creates a GitHub issue)
- `GET /api/proxy` — Proxy GET requests to external URLs (used by the frontend for CORS-restricted resources); HTTPS-only, blocks private/loopback IPs, restricts to `.pmtiles`/`.tif`/`.tiff` extensions, rejects redirects, caps responses at 50 MB
- `GET /api/health` — Health check

### Example datasets

On startup, the ingestion service runs a background task (`src/services/example_datasets.py`) that registers the curated source.coop products as shared "example" datasets. These rows carry `is_example=True`, are owned by no workspace, cannot be deleted or modified via the API, and are surfaced to every workspace's `GET /api/datasets` response so a fresh deploy never has an empty library. The task is idempotent across restarts (it skips products whose `listing_url` is already present on an example row) and registers fast products before slow ones so the gallery populates quickly. PMTiles-kind products are registered via `src/services/pmtiles_register.py`, which probes the first 127 bytes of the remote file (`src/services/pmtiles_header.py`) to extract bounds, min/max zoom, and verify the tile type is MVT; mosaic-kind products are enumerated and registered via `register_remote_collection`.

### Conversion pipeline

1. **Upload/fetch** → save raw file
2. **Scan** → detect file type, validate; for rasters also runs categorical detection (color table → RAT → heuristic)
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

### GDAL + R2 env vars

Any service that uses GDAL to read from R2 (the raster tiler, plus the ingestion service when reading COGs back during conversion) needs the same env-var set in `docker-compose.yml`:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — R2 credentials
- `AWS_ENDPOINT_URL` — full R2 endpoint (`https://<account>.r2.cloudflarestorage.com`)
- `AWS_S3_ENDPOINT` — hostname only (`<account>.r2.cloudflarestorage.com`), required by GDAL < 3.11
- `AWS_HTTPS=YES`
- `AWS_VIRTUAL_HOSTING=FALSE` — forces path-style URLs (required for R2)

## MCP Server

A Model Context Protocol server that wraps the ingestion API, exposing datasets, stories, connections, and validation as composable tools for MCP-compatible agents (Claude Desktop, Claude Code, etc.). Source in `mcp/src/cng_mcp/`.

### Running tests

```bash
cd mcp && uv run pytest -v
```

### Tools

- `read_datasets` — List workspace datasets
- `read_story` / `create_story` / `update_story` — Manage stories
- `read_connections` — List external tile source connections
- `validate_layer_config` — Pre-flight check for a chapter's layer config

### Resources

- `cng://datasets` — Catalog of datasets in the workspace
- `cng://story-templates` — Pre-built story templates agents can reference
- `cng://colormaps` — Valid colormap names

### Running the server

```bash
cng-mcp --api-url http://localhost:8086 --workspace-id <8-char-id>   # Communicates over stdio
```

The ingestion API requires an `X-Workspace-Id` header on workspace-listing endpoints (`GET /api/datasets`, `GET /api/connections`, `GET /api/stories`). The MCP server forwards this header when started with `--workspace-id` (or `SANDBOX_WORKSPACE_ID` env var). Without it, those listing endpoints will return 400 and the MCP tools will surface empty results.

See `mcp/README.md` for client config examples and `mcp/ARCHITECTURE.md` for design notes.

### Open dependency

`validate_layer_config` calls `POST /api/validate-layer-config` on the ingestion service, which does not yet exist. The tool is wired up in advance of that endpoint landing.

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
