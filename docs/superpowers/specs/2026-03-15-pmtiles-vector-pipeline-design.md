# PMTiles Vector Pipeline Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Replace tipg-based tile serving with PMTiles for polygon/line datasets, delivering zero-simplification, full-fidelity vector tiles served directly from MinIO via HTTP range requests.

**Architecture:** The vector ingest path splits on geometry type after validation. Polygon/line datasets go through tippecanoe → PMTiles → MinIO and are served directly by MapLibre using the pmtiles-js protocol handler. Point datasets continue through the existing PostGIS → tipg path unchanged. tipg stays in the stack for point tile serving and future OGC Features API use.

**Tech Stack:** tippecanoe (tile generation), pmtiles-js (already in codebase), MinIO (storage), MapLibre GL JS (rendering), geopandas (GeoJSON export for tippecanoe input)

---

## Architecture

```
Upload → Scan → Convert (→ GeoParquet) → Validate → [geometry type?]
                                                           ↓              ↓
                                                    Polygon/Line        Point
                                                           ↓              ↓
                                                     tippecanoe      PostGIS → tipg
                                                           ↓              ↓
                                                  .pmtiles → MinIO   tile URL (/vector/...)
                                                           ↓              ↓
                                           MapLibre (range requests)  MapLibre (vector tiles)
```

### Geometry type decision

Detected from the GeoParquet file in `pipeline.py` using geopandas:

```python
gdf = gpd.read_parquet(output_path)
use_pmtiles = gdf.geom_type.isin(
    ["Polygon", "MultiPolygon", "LineString", "MultiLineString"]
).any()
```

- **Any polygon or line features present** → `pmtiles_ingest.py` (new module). tippecanoe handles mixed geometry (points + polygons in the same dataset) correctly.
- **Purely point dataset** → existing `vector_ingest.py`
- **`GeometryCollection` type**: not detected by this check; treated as points and routed to tipg. This is an acceptable limitation — GeometryCollection is extremely rare in practice.

---

## tippecanoe Integration

tippecanoe is installed in the ingestion container via `apt-get install -y tippecanoe` in the ingestion `Dockerfile`.

A new `pmtiles_ingest.py` service module handles the polygon/line path:

1. Export GeoParquet → GeoJSON using geopandas (`gdf.to_file(path, driver="GeoJSON")`)
2. Run tippecanoe as a subprocess:

```
tippecanoe \
  --output=output.pmtiles \
  --no-feature-limit \
  --no-tile-size-limit \
  --force \
  --maximum-zoom=14 \
  --layer=default \
  input.geojson
```

- `--no-feature-limit` / `--no-tile-size-limit`: never drop features; tippecanoe still applies zoom-appropriate visual simplification but discards nothing
- `--maximum-zoom=14`: sufficient for country-to-street-level detail
- `--force`: overwrite output if it exists (safe in a temp directory)

3. Upload resulting `.pmtiles` to MinIO
4. Return tile URL

The function signature mirrors `vector_ingest.ingest_vector`:

```python
def ingest_pmtiles(dataset_id: str, parquet_path: str) -> str:
    """Convert GeoParquet to PMTiles and upload to MinIO. Returns tile URL."""
```

---

## Storage & Serving

### MinIO storage

PMTiles files are stored at `datasets/{dataset_id}/converted/data.pmtiles` in the `sandbox-data` bucket, following the same key structure as `upload_converted`. `StorageService` gets a new method that reuses this pattern:

```python
def upload_pmtiles(self, local_path: str, dataset_id: str) -> str:
    """Upload a .pmtiles file to MinIO. Returns the storage key."""
    key = f"datasets/{dataset_id}/converted/data.pmtiles"
    self.s3.upload_file(local_path, self.bucket, key)
    return key
```

### Vite proxy

A new `/pmtiles` proxy entry in `sandbox/frontend/vite.config.ts` forwards range requests to MinIO:

```typescript
"/pmtiles": {
  target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/pmtiles/, "/sandbox-data"),
},
```

(`sandbox-data` is the MinIO bucket name, set via `S3_BUCKET=sandbox-data` in `sandbox/.env`.)

### tile_url format

The `tile_url` field on the `Dataset` model stores a relative path:

```
/pmtiles/datasets/{dataset_id}/converted/data.pmtiles
```

The frontend detects this prefix to select the PMTiles rendering path. No new fields are added to the dataset model.

---

## Frontend Changes (VectorMap.tsx)

### Protocol detection

`VectorMap.tsx` inspects `tile_url` to select the rendering path:

```typescript
const isPMTiles = dataset.tile_url.startsWith("/pmtiles/");
```

### PMTiles path

When `isPMTiles` is true:

1. Register the pmtiles protocol in the map init `useEffect`, with cleanup on unmount to prevent double-registration when the map is recreated:

```typescript
import { addProtocol, removeProtocol } from "maplibre-gl";
import { createPMTilesProtocol } from "@maptool/core";

// Inside the map init useEffect, before new maplibregl.Map(...):
// Note: protocol.tile does NOT need .bind() — pmtiles-js uses arrow functions internally.
// This matches the pattern used in tests/building-footprints and tests/coastal-explorer.
const { protocol, cleanup } = createPMTilesProtocol();
addProtocol("pmtiles", protocol.tile);

// In the useEffect cleanup (return):
return () => {
  removeProtocol("pmtiles");
  cleanup();
  map.remove();
};
```

2. Add source with `pmtiles://` prefix:

```typescript
const pmtilesUrl = `pmtiles://${window.location.origin}${dataset.tile_url}`;
map.addSource("vector-data", {
  type: "vector",
  url: pmtilesUrl,
});
```

3. Layers remain identical — same fill/line/circle layers with `source-layer: "default"` (tippecanoe uses `"default"` as the default layer name, matching tipg).

### tipg path

When `isPMTiles` is false, `VectorMap.tsx` behaves exactly as today. No changes to the tipg rendering path.

### Zoom clamp removal

The `if (map.getZoom() < 2) map.setZoom(2)` clamp added as a vertex-limit workaround is removed. PMTiles handles zoom 0 correctly.

---

## Rollback of Simplification Workarounds

All geometry simplification added as workarounds for the MapLibre vertex limit is removed:

| File | Change |
|------|--------|
| `sandbox/ingestion/src/services/vector_ingest.py` | Remove the `simplify(0.05)` block entirely |
| `sandbox/frontend/src/components/VectorMap.tsx` | Remove `if (map.getZoom() < 2) map.setZoom(2)` |
| `skills/geo-conversions/*/scripts/validate.py` | Revert `check_geometry_complexity` to return `passed=False` above threshold (valid warning for standalone use) |
| `skills/geo-conversions/*/SKILL.md` | Update known failure modes to note that the sandbox pipeline now uses PMTiles for polygon/line data, so ST_AsMVT and MapLibre vertex errors don't apply to that path |

The `check_geometry_complexity` check in the validation scripts remains as-is (warns when vertex count is high) — it's still a valid signal for standalone users who will load data into PostGIS directly.

---

## pipeline.py Changes

Three changes required in `pipeline.py` beyond the geometry-type routing:

**1. Skip `_wait_for_tipg_collection` for the PMTiles path.** This call is only needed for tipg-served datasets:

```python
if not use_pmtiles:
    await _wait_for_tipg_collection(job.dataset_id)
```

**2. Set `pg_table=None` for PMTiles datasets.** PMTiles datasets are never loaded into PostGIS, so there is no table to reference:

```python
pg_table=vector_ingest.build_table_name(job.dataset_id) if (
    format_pair.dataset_type == DatasetType.VECTOR and not use_pmtiles
) else None,
```

**3. Update `get_credits` for PMTiles datasets.** `get_credits` gains an optional `use_pmtiles: bool = False` parameter. When True, tippecanoe and pmtiles-js replace tipg as the tile serving credit:

```python
def get_credits(format_pair: FormatPair, use_pmtiles: bool = False) -> list[dict]:
    credits = []
    # ... existing converter credits unchanged ...

    if format_pair.dataset_type == DatasetType.RASTER:
        credits.append({"tool": "TiTiler", "url": "https://developmentseed.org/titiler", "role": "Tiles served by"})
        credits.append({"tool": "pgSTAC", "url": "https://github.com/stac-utils/pgstac", "role": "Cataloged by"})
    elif use_pmtiles:
        credits.append({"tool": "tippecanoe", "url": "https://github.com/felt/tippecanoe", "role": "Tiles generated by"})
        credits.append({"tool": "PMTiles", "url": "https://github.com/protomaps/PMTiles", "role": "Tiles served by"})
    else:
        credits.append({"tool": "tipg", "url": "https://github.com/developmentseed/tipg", "role": "Tiles served by"})

    credits.append({"tool": "MapLibre", "url": "https://maplibre.org", "role": "Map rendered by"})
    return credits
```

Call site in `run_pipeline`: `get_credits(format_pair, use_pmtiles=use_pmtiles)`.

## Error Handling

- **tippecanoe not found**: subprocess raises `FileNotFoundError` → pipeline sets `job.status = FAILED` with descriptive error
- **tippecanoe non-zero exit**: capture stderr, surface in job error
- **MinIO upload failure**: existing `StorageService` error handling applies
- **Empty GeoJSON export**: check row count before running tippecanoe; fail fast with clear error

---

## What Is Not Changed

- Raster pipeline (GeoTIFF, NetCDF → COG → titiler-pgstac) — untouched
- Point dataset pipeline (PostGIS → tipg) — untouched
- tipg service in docker-compose — stays running
- PostGIS — stays running (used by tipg for point data)
- `_wait_for_tipg_collection` polling — stays (still needed for point datasets)
- Vite `/vector` proxy with `no-store` cache override — stays (still needed for point datasets)

---

## Changelog

- 2026-03-15: Initial design
