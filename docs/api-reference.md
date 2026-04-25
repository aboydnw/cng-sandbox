# Ingestion API Reference

Read this when working on any endpoint under `/api/*`, adding new routes, debugging frontend ↔ backend contracts, or when the MCP server needs a new tool.

**Workspace header**: Workspace-listing reads (`GET /api/datasets`, `GET /api/stories`, `GET /api/connections`) require an `X-Workspace-Id` header identifying the caller's 8-character workspace. Without it the server returns 400. The Vite dev proxy and the MCP server both forward this header; direct API callers must set it themselves.

**Rate limiting**: Abuse-prone endpoints are rate-limited via slowapi (see `src/rate_limit.py`). Limits are keyed by `X-Workspace-Id` when present, otherwise by remote IP. Exceeding a limit returns 429 with a `Retry-After` header. A default ceiling of 300/minute applies globally; per-endpoint limits are noted alongside each route below.

**SSRF protection on URL fetches**: Endpoints that fetch user-supplied URLs (`/api/upload` via `convert-url`, `/api/connections`, `/api/inspect-url`, `/api/proxy`, `/api/connect-remote`, `/api/discover`) call `validate_url_safe()` to block private/loopback/reserved IPs and disable HTTP redirect following. Redirects are explicitly rejected (via `raise_if_redirect`) because the redirect target cannot be re-validated safely.

## Upload & conversion

- `POST /api/upload` — Upload a file (multipart form); returns 409 with `{"detail": "duplicate_dataset", "dataset_id": ..., "filename": ...}` if a file with the same name already exists in the workspace. Rate-limited to 20/hour
- `POST /api/convert-url` — Fetch and convert a file from a URL; same 409 duplicate response as above; rejects 3xx redirects from the source URL (returns 400). Rate-limited to 20/hour
- `GET /api/check-duplicate?filename=<name>` — Preflight duplicate check; returns 409 if a dataset with that filename exists, or `{"duplicate": false}` if not
- `POST /api/check-format` — Pre-upload format validation; accepts a file chunk and filename, returns `{"valid": true}` or `{"valid": false, "error": "..."}`
- `POST /api/upload-temporal` — Upload multiple raster files as a time series (2–50 files, same format). Rate-limited to 10/hour
- `POST /api/scan/{scan_id}/convert` — Trigger conversion after a scan completes

## Jobs

- `GET /api/jobs/{id}` — Get job status
- `GET /api/jobs/{id}/stream` — SSE stream of conversion progress; no workspace auth on this endpoint (EventSource cannot send custom headers); job UUIDs are the only access barrier — a scoped auth token or cookie-based workspace auth would be more robust for production

## Datasets

- `GET /api/datasets` — List datasets belonging to the caller's workspace plus any dataset flagged `is_example=True` (example datasets are visible to every workspace). Requires `X-Workspace-Id` header (returns 400 without it).
- `GET /api/datasets/{id}` — Get dataset metadata (includes `tile_url`, `is_example`, and `is_shared`); returns 404 if the caller's workspace does not own the dataset and the dataset is not an example, not explicitly shared, and not referenced by a published story
- `PATCH /api/datasets/{id}` — Update editable dataset metadata (currently just `title`, 1–200 chars; pass `null` to clear); returns 403 if the dataset is an example or belongs to another workspace
- `PATCH /api/datasets/{id}/share` — Toggle public sharing; body `{"is_shared": true|false}`; returns 403 if the dataset is an example or belongs to another workspace
- `DELETE /api/datasets/{id}` — Delete a dataset; returns 403 if the dataset is an example (`is_example=True`) or belongs to another workspace
- `PATCH /api/datasets/{id}/categories` — Update category labels and/or colors for a categorical raster; body is a list of `{"value": int, "label"?: str, "color"?: "#RRGGBB"}` objects (each entry must include at least one of `label` or `color`); the first color override snapshots the prior color into `defaultColor` so the UI can offer a reset; returns 400 if dataset is not categorical or a value doesn't exist, 403 if the dataset is an example
- `POST /api/datasets/{id}/mark-categorical` — Promote a non-categorical integer raster to categorical by scanning unique values and assigning default colors from the qualitative palette; returns 400 if values can't be extracted (unsupported dtype or too many unique values), 403 if the dataset is an example or belongs to another workspace
- `POST /api/datasets/{id}/unmark-categorical` — Demote a categorical raster back to continuous by clearing `is_categorical` and `categories` from metadata; returns 409 if the dataset is not currently categorical, 400 if the dataset is not a raster, 403 if the dataset is an example or belongs to another workspace
- `PATCH /api/datasets/{id}/render-mode` — Persist the user's chosen render mode (`"client"`, `"server"`, or `null` to clear); body `{"render_mode": "client"|"server"|null}`; returns 400 if `"client"` is requested but eligibility checks fail (e.g. no COG URL, temporal dataset, oversized file), 403 if the dataset is an example or belongs to another workspace

## Stories (shareable map narratives)

- `POST /api/stories` — Create a story with chapters linking to datasets
- `GET /api/stories` — List stories belonging to the caller's workspace plus any story flagged `is_example=True` (example stories are visible to every workspace). Requires `X-Workspace-Id` header (returns 400 without it).
- `GET /api/stories/{id}` — Get a story by ID
- `PATCH /api/stories/{id}` — Update a story; returns 403 if the story is an example (`is_example=True`)
- `POST /api/stories/{id}/fork` — Fork a story (clones chapters/metadata into a new story owned by the caller's workspace with `published=False` and `is_example=False`)
- `DELETE /api/stories/{id}` — Delete a story; returns 403 if the story is an example

## Connections (external tile sources)

- `GET /api/connections` — List connections in the workspace. Requires `X-Workspace-Id` header (returns 400 without it).
- `POST /api/connections` — Register an external data source (XYZ raster/vector, COG, PMTiles, GeoParquet); validates the URL with `validate_url_safe` (blocks private/loopback IPs) and rejects HEAD redirects on the size probe. COG connections automatically run categorical detection and persist `is_categorical` + `categories` on the connection row. GeoParquet connections support two render paths via the optional `render_path` field: `"client"` (DuckDB-WASM) or `"server"` (tippecanoe → PMTiles → R2, async background job). When omitted, the server infers the path by issuing a HEAD request for the file size: files over 50 MB → `"server"`, otherwise → `"client"`. Rate-limited to 30/hour
- `GET /api/connections/{id}/stream` — SSE stream of server-side conversion progress for a GeoParquet connection; emits `event: status` events with `{status, tile_url, error, feature_count}`; no workspace auth on this endpoint (EventSource cannot send custom headers); connection UUIDs are the only access barrier — a scoped auth token or cookie-based workspace auth would be more robust for production
- `GET /api/connections/{id}` — Get a connection by ID; returns 404 if the caller's workspace does not own the connection and it is not explicitly shared or referenced by a published story
- `PATCH /api/connections/{id}/share` — Toggle public sharing; body `{"is_shared": true|false}`; returns 403 if the connection belongs to another workspace
- `PATCH /api/connections/{id}/categories` — Update category labels and/or colors for a categorical COG connection; body is a list of `{"value": int, "label"?: str, "color"?: "#RRGGBB"}` objects (each entry must include at least one of `label` or `color`); the first color override snapshots the prior color into `defaultColor`; returns 400 if connection is not categorical or a value doesn't exist
- `PATCH /api/connections/{id}/render-mode` — Persist the user's chosen render mode (`"client"`, `"server"`, or `null` to clear); body `{"render_mode": "client"|"server"|null}`; returns 400 if `"client"` is requested but eligibility checks fail, 403 if the connection belongs to another workspace
- `DELETE /api/connections/{id}` — Delete a connection

## Remote data discovery

- `POST /api/discover` — Discover geospatial files at a URL or S3 prefix. Rate-limited to 30/hour
- `POST /api/connect-remote` — Connect remote files as a mosaic or temporal dataset. Rate-limited to 30/hour
- `POST /api/connect-source-coop` — Register a curated source.coop product as a zero-copy pgSTAC collection (v1 products: `ausantarctic/ghrsst-mur-v2`, `alexgleith/gebco-2024`, `vizzuality/lg-land-carbon-data`, `vida/google-microsoft-osm-open-buildings`). Raster products (`kind="mosaic"`) run a STAC/path enumerator and register as pgSTAC mosaics; PMTiles products (`kind="pmtiles"`) read the remote PMTiles v3 header for bounds/zoom and register as a `FormatPair.PMTILES` vector dataset pointing at the source URL.

## Other

- `POST /api/bug-report` — Submit a bug report (creates a GitHub issue). Rate-limited to 5/hour
- `POST /api/inspect-url` — Inspect a remote URL before registering it as a connection; body `{"url": "..."}`; returns `{format, is_cog, size_bytes, bounds, has_errors, error_detail}` (`bounds` is reserved for future use and always `null` currently). Format is detected from the path/template (`xyz`, `pmtiles`, `parquet`, `cog`, `tiff`, `geojson`, or `unknown`). For non-XYZ URLs, runs SSRF validation (`validate_url_safe`) and a HEAD probe for `content-length` with redirects disabled (3xx responses are surfaced via `error_detail`). When the detected format is `tiff` and the HEAD probe succeeds, also runs `check_remote_is_cog` (10s timeout) to refine the `is_cog` flag; probe failures are swallowed and surfaced as `is_cog=false` rather than as errors. Rate-limited to 120/hour
- `GET /api/proxy` — Proxy GET requests to external URLs (used by the frontend for CORS-restricted resources); HTTPS-only, blocks private/loopback IPs, restricts to `.pmtiles`/`.tif`/`.tiff` extensions, rejects redirects, caps responses at 50 MB. Rate-limited to 120/hour
- `GET /api/health` — Health check
