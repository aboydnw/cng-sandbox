# Cloud-Optimized Data Connections

**Issue:** [#55](https://github.com/aboydnw/cng-sandbox/issues/55)
**Date:** 2026-03-27
**Status:** Draft

## Problem

Scientists who already have cloud-optimized data in S3 (COGs, PMTiles) or running tile servers must currently download and re-upload their data to visualize it in the sandbox. This is wasteful when the data is already in a serveable format.

## Solution

Add **connections** as a first-class concept alongside datasets. A connection points to an external data source — either a cloud-optimized file (COG, PMTiles) or a tile endpoint (XYZ raster/vector) — and the sandbox renders it directly without copying or converting.

## Approach

**Lightweight backend entity with client-side detection (Approach C).** The backend stores connection records (name, URL, type, metadata) but does no URL probing. The frontend handles auto-detection and sends resolved metadata to the backend for persistence. This keeps the backend simple while giving us persistence, workspace scoping, and story integration.

## Scope

**In scope:**
- COGs in public S3 (rendered via our titiler's `/cog/` endpoints)
- Remote PMTiles (raster and vector, rendered client-side)
- XYZ raster tile endpoints
- XYZ vector tile (MVT) endpoints
- Library page with connections tab
- Styling controls matching existing dataset controls
- Story integration (connections usable as chapter layers)

**Out of scope:**
- Remote GeoParquet (see [#61](https://github.com/aboydnw/cng-sandbox/issues/61))
- Private/authenticated S3 buckets
- Editing connections after creation (delete and re-create)

## Data Model

### Connection record

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `name` | string | User-provided display name |
| `url` | string | The source URL |
| `connection_type` | enum | `xyz_raster`, `xyz_vector`, `cog`, `pmtiles` |
| `bounds` | [w, s, e, n] \| null | EPSG:4326, detected or user-provided |
| `min_zoom` | int \| null | Detected or user-provided |
| `max_zoom` | int \| null | Detected or user-provided |
| `tile_type` | `raster` \| `vector` \| null | For PMTiles: read from header. For XYZ: inferred from `connection_type`. For COG: always `raster`. Determines rendering path. |
| `workspace_id` | string \| null | Workspace scoping (same as datasets) |
| `created_at` | datetime | Auto-set |

No `tile_url` field. The `url` is the source; the frontend constructs the appropriate tile URL at render time (e.g., wrapping a COG URL in a titiler `/cog/tiles/...?url=` request).

### Database migration

New `connections` table in PostgreSQL. No foreign keys to `datasets`. Uses the same `workspace_id` pattern for scoping.

## Backend API

Four CRUD endpoints under `/api/connections`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/connections` | GET | List all connections (workspace-filtered via `X-Workspace-Id` header) |
| `/api/connections` | POST | Create a connection |
| `/api/connections/{id}` | GET | Get single connection |
| `/api/connections/{id}` | DELETE | Delete a connection |

### POST body

```json
{
  "name": "My satellite imagery",
  "url": "https://bucket.s3.amazonaws.com/scene.tif",
  "connection_type": "cog",
  "bounds": [-122.5, 37.5, -122.0, 38.0],
  "min_zoom": 0,
  "max_zoom": 18
}
```

### Response shape

```json
{
  "id": "uuid",
  "name": "My satellite imagery",
  "url": "https://bucket.s3.amazonaws.com/scene.tif",
  "connection_type": "cog",
  "bounds": [-122.5, 37.5, -122.0, 38.0],
  "min_zoom": 0,
  "max_zoom": 18,
  "workspace_id": "abc123",
  "created_at": "2026-03-27T12:00:00Z"
}
```

The backend does zero URL probing or validation beyond basic format checks (valid URL, recognized `connection_type` enum value). It trusts the frontend's detection results.

## Frontend: Connection Creation Flow

### Entry point

"Add connection" button on the library page, alongside the existing upload trigger.

### ConnectionModal

A modal form with:

1. **URL input** (required) — paste an S3 URL, tile endpoint, or PMTiles URL
2. **Name input** (required) — auto-populated from filename/hostname extracted from URL, editable
3. **Type selector** — auto-detected from URL, user can override. Options: COG, PMTiles, XYZ Raster Tiles, XYZ Vector Tiles

### Auto-detection logic

Runs when the URL input loses focus or after a short debounce:

| Signal | Detected type |
|--------|--------------|
| `.tif` / `.tiff` extension | `cog` |
| `.pmtiles` extension | `pmtiles` |
| `{z}`, `{x}`, `{y}` placeholders in URL | `xyz_raster` (user can switch to `xyz_vector`) |
| None of the above | Unknown — user must select type manually |

### Metadata probing by type

After detection, the frontend probes for metadata:

- **COG**: Fetch our titiler's `/cog/info?url={encoded_url}` to get bounds, min/max zoom, band count, band names, dtype. Fetch `/cog/statistics?url={encoded_url}` for raster min/max.
- **PMTiles**: Fetch the PMTiles header (first ~16KB) to read bounds, min/max zoom, tile type (raster vs vector), and layer metadata.
- **XYZ raster/vector**: No probing possible. Bounds default to null (map starts at global view). User can optionally provide bounds and zoom range.

### Preview panel

After successful detection, show a small map preview in the modal so the user can confirm the data loads before saving.

### Save

POST to `/api/connections`. On success, the connection appears in the library's Connections tab.

## Library Page Integration

### Layout

Two tabs at the top of the library page: **Datasets** and **Connections**. Each tab has its own table and empty state.

### Connections table

| Column | Content |
|--------|---------|
| Name | Clickable, navigates to map view |
| Type | Badge: COG, PMTiles, XYZ Raster, XYZ Vector |
| URL | Truncated display |
| Added | Relative time (e.g., "3 hours ago") |
| Actions | Delete button |

### Empty state

"Connect to external data sources like COGs, PMTiles, or tile endpoints" with the "Add connection" button.

### Navigation

Clicking a connection navigates to `/map/connection/{id}`.

## Map Rendering for Connections

When viewing a connection at `/map/connection/{id}`, the MapPage fetches the connection record and builds layers based on `connection_type`:

### COG

- Tile URL: `/raster/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url={encoded_cog_url}`
- Fetches band info and statistics from titiler at render time (`/cog/info`, `/cog/statistics`)
- Full raster sidebar controls: colormap picker, band selector, opacity slider
- Legend support via the existing MapLegend component

### PMTiles (vector)

- Same PMTiles rendering path as existing vector datasets
- Frontend reads the PMTiles file directly via the pmtiles library
- Vector styling controls (same as existing vector datasets)

### PMTiles (raster)

- Rendered client-side via deck.gl BitmapLayer reading from PMTiles
- Opacity control

### XYZ Raster

- TileLayer with the user-provided URL template
- Opacity control only (no colormap — tiles are pre-rendered)

### XYZ Vector (MVT)

- MVTLayer with the user-provided URL template
- Vector styling controls (fill color, stroke, opacity)

### Shared behavior

- If `bounds` is available, the map flies to the data extent on load
- If `bounds` is null (XYZ types), the map starts at a global view
- The side panel shows connection metadata (name, type, URL) instead of the conversion summary card

## Story Integration

### LayerConfig extension

```typescript
export interface LayerConfig {
  dataset_id?: string;      // existing — one or the other is set
  connection_id?: string;    // new
  colormap: string;
  opacity: number;
  basemap: string;
  band?: number;
  timestep?: number;
}
```

When building layers for a chapter, the rendering logic checks which ID is present and fetches the appropriate record (dataset or connection).

### Story editor

The dataset picker in the story editor adds a second section (or toggle) showing available connections alongside datasets. Connection entries display their type badge for clarity.

### Styling constraints

XYZ raster connections don't support colormap changes (tiles are pre-rendered). The story editor disables the colormap picker when an XYZ raster connection is selected.

## Error Handling

- **URL unreachable**: Detection step shows an error in the modal. User can still save if they override the type manually (useful for URLs that block CORS preflight but serve tiles fine).
- **CORS issues on external tile servers**: Common for XYZ endpoints. The frontend can't probe these, but they'll work at render time since tile requests don't require CORS for image tiles. For MVT, CORS is required — show a warning if detection fails.
- **COG not publicly accessible**: Titiler returns an error when fetching info. Show a clear message: "This COG doesn't appear to be publicly accessible."
- **Deleted/moved external data**: Connections may break over time if the source is removed. The map view shows a clear error state rather than a blank map.

## Testing Strategy

### Backend
- Unit tests for connection CRUD operations
- Workspace isolation tests (connections scoped to workspace)

### Frontend
- Unit tests for URL auto-detection logic
- Unit tests for tile URL construction per connection type
- Integration test: create connection → appears in library → opens in map view

## Future Considerations

- **Remote GeoParquet** ([#61](https://github.com/aboydnw/cng-sandbox/issues/61)): Would add a `geoparquet` connection type with a server-side conversion step
- **Authenticated S3 buckets**: Would require credential management (signed URLs or IAM role assumption)
- **Connection editing**: PUT endpoint + edit modal if users need to update URLs or metadata
- **Connection sharing**: Share connections across workspaces or make them public
