# Plan: Integrate DS Open Source Libraries

Integrate three Development Seed open source libraries into CNG Sandbox to replace hand-rolled code, add validation, and give users a client-side raster rendering option alongside the existing tile server.

## 1. Replace hand-rolled STAC with rio-stac + pystac

### Problem

`ingestion/src/services/stac_ingest.py` manually constructs STAC collections and items as raw Python dicts (~140 lines). This means:

- Geometry is built by hand (bbox → polygon coordinate list)
- Metadata extraction (CRS, bounds, band count, dtype) is done manually with rasterio
- No validation — a malformed STAC item won't be caught until the Transaction API rejects it
- Temporal extent aggregation is manual
- Any STAC spec changes require updating our dict structures by hand

### Solution

**rio-stac** generates a valid STAC item directly from a raster file. It handles bounds extraction, CRS reprojection to EPSG:4326, geometry construction, asset creation, and datetime handling in a single function call. **pystac** provides typed Python objects (`pystac.Item`, `pystac.Collection`) with built-in validation and serialization.

### Changes

**`ingestion/pyproject.toml`**
- Add `rio-stac >= 0.10.0` and `pystac >= 1.10.0` to dependencies

**`ingestion/src/services/stac_ingest.py`**

Replace `get_cog_metadata()` + `build_item()`:
```python
# Before: ~50 lines of manual rasterio + dict construction
meta = get_cog_metadata(cog_path)
item = build_item(dataset_id, filename, s3_href, meta["bbox"])

# After: one function call
from rio_stac import create_stac_item
item = create_stac_item(
    source=cog_path,
    id=f"{dataset_id}-data",
    collection=f"sandbox-{dataset_id}",
    asset_href=s3_href,
    asset_media_type="image/tiff; application=geotiff; profile=cloud-optimized",
    asset_roles=["data"],
)
```

Replace `build_collection()` + `build_temporal_collection()`:
```python
# Before: manual dict with hand-built extent
collection = build_collection(dataset_id, filename, meta["bbox"])

# After: pystac object with validation
import pystac
collection = pystac.Collection(
    id=f"sandbox-{dataset_id}",
    description=f"User upload: {filename}",
    extent=pystac.Extent(
        spatial=pystac.SpatialExtent(bboxes=[item.bbox]),
        temporal=pystac.TemporalExtent(intervals=[[item.datetime, None]]),
    ),
)
collection.validate()  # catches issues before we POST
```

Replace temporal item construction (`build_temporal_item`):
```python
# rio-stac can extract datetime from the file or accept it as a parameter
# Loop over timesteps, creating one item per COG
for i, (cog_path, s3_href, dt) in enumerate(zip(cog_paths, s3_hrefs, datetimes)):
    item = create_stac_item(
        source=cog_path,
        id=f"{dataset_id}-{i}",
        collection=f"sandbox-{dataset_id}",
        input_datetime=datetime.fromisoformat(dt),
        asset_href=s3_href,
        asset_media_type="image/tiff; application=geotiff; profile=cloud-optimized",
        asset_roles=["data"],
    )
```

The `ingest_raster()` and `ingest_temporal_raster()` functions keep the same httpx POST logic but call `item.to_dict()` instead of passing raw dicts. The bbox extraction for temporal collection extent comes from the first item's bbox rather than being computed separately.

**Functions to delete**: `get_cog_metadata()`, `build_collection()`, `build_item()`, `build_temporal_collection()`, `build_temporal_item()`. That's ~90 lines removed.

**`ingestion/tests/test_stac_ingest.py`**
- Update tests to verify pystac objects validate correctly
- Add a test that creates a STAC item from a real COG fixture and checks the output matches expected bbox/geometry/assets
- Remove tests for the deleted helper functions

### Risk

Low. rio-stac and pystac are mature, widely-used libraries that DS maintains. The Transaction API contract doesn't change — we're just producing better-validated dicts. The main risk is if rio-stac's default asset structure differs from what pgstac/titiler-pgstac expect, but this is easy to verify with a quick integration test.

---

## 2. Add geojson-pydantic for geometry validation

### Problem

GeoJSON geometries flow through the ingestion pipeline in several places:
- STAC item geometries (currently hand-built bbox→polygon dicts)
- Uploaded GeoJSON files (passed through to GeoPandas without schema validation)
- Dataset bounds reported back to the frontend

None of these are validated against the GeoJSON spec. A malformed geometry (e.g., unclosed ring, coordinates in wrong order) could silently propagate into pgSTAC and cause tile rendering failures that are hard to debug.

### Solution

**geojson-pydantic** provides Pydantic models for GeoJSON types (`Point`, `Polygon`, `Feature`, `FeatureCollection`, etc.). Since the ingestion service already uses Pydantic extensively (`pydantic-settings` for config, Pydantic models for API schemas), this fits the existing pattern.

### Changes

**`ingestion/pyproject.toml`**
- Add `geojson-pydantic >= 1.1.0`

**`ingestion/src/services/stac_ingest.py`**
- After rio-stac creates a STAC item, validate the geometry:
```python
from geojson_pydantic import Polygon
# Validates coordinates, ring closure, winding order
Polygon.model_validate(item.geometry)
```
- This is a safety net — rio-stac should produce valid geometry, but this catches edge cases (e.g., raster files with degenerate bounds)

**`ingestion/src/services/pipeline.py`** (vector upload path)
- When a user uploads a GeoJSON file, validate the top-level structure before passing to GeoPandas:
```python
from geojson_pydantic import FeatureCollection
try:
    FeatureCollection.model_validate_json(raw_bytes)
except ValidationError as e:
    raise UserFacingError(f"Invalid GeoJSON: {e}")
```
- This gives users a clear error message ("your GeoJSON has an unclosed ring at feature 12") instead of a cryptic GeoPandas traceback

**`ingestion/src/models/`** (if API response schemas exist)
- Use `geojson_pydantic.Polygon` as the type for bbox-derived geometry fields in any Pydantic response models, so the API schema self-documents

### Risk

Very low. This is additive validation — it doesn't change any data flow, just catches bad data earlier. geojson-pydantic is a lightweight, zero-dependency-beyond-pydantic library.

---

## 3. Add deck.gl-raster as a side-by-side raster rendering comparison

### Problem

Raster datasets currently have a single rendering path: titiler-pgstac generates PNG tiles server-side, and the frontend displays them via deck.gl `TileLayer` + `BitmapLayer`. This works well but:

- Every colormap or band change triggers a full tile re-fetch from the server
- The user can't see what client-side rendering looks like or how it compares
- There's no way to visualize a COG without the full eoAPI stack running

### Solution

Add **deck.gl-raster** as a client-side rendering alternative, following the same comparison pattern used for vector datasets. Vector datasets already let users switch between a **PMTiles** tab (tile-server rendered) and a **GeoParquet** tab (client-side DuckDB + deck.gl). Raster datasets should offer a similar toggle between **Tile Server** (titiler, current behavior) and **Client Rendering** (deck.gl-raster, reads COG directly from MinIO).

### UX Design

The raster dataset detail page gets a tab bar (matching the vector dataset pattern):

```
┌─────────────┬──────────────────┐
│ Tile Server  │ Client Rendering │
└─────────────┴──────────────────┘
```

**Tile Server tab** (default): Current `RasterMap.tsx` behavior. Server-rendered PNG tiles from titiler-pgstac. Colormap/band changes trigger tile re-fetches.

**Client Rendering tab**: deck.gl-raster reads the COG directly from the MinIO S3 URL. Colormap and band switching happens instantly on the GPU with no network requests. Shows a performance comparison badge (e.g., "Colormap change: ~0ms" vs the tile server's re-fetch time).

Both tabs share the same basemap, viewport state, opacity slider, and colormap selector so the user can flip between them and see the exact same view rendered two different ways. This mirrors how the vector comparison lets users see the same data rendered via PMTiles vs GeoParquet.

### Changes

**`frontend/package.json`**
- Add `deck.gl-raster` (check latest version on npm — this is a DS-maintained package)
- May also need `@luma.gl/webgl` depending on deck.gl-raster's peer deps

**`frontend/src/lib/maptool/DirectCOGLayer.ts`** (new file)
- Wrapper around deck.gl-raster that creates a layer from a COG URL:
```typescript
import { RasterLayer } from 'deck.gl-raster';  // verify actual export name

export interface DirectCOGLayerOptions {
  id: string;
  cogUrl: string;        // Direct S3/MinIO URL to the COG file
  colormap?: string;
  band?: number;
  opacity?: number;
  visible?: boolean;
}

export function createDirectCOGLayer(options: DirectCOGLayerOptions) {
  // deck.gl-raster reads COG byte ranges directly via HTTP Range requests
  // and renders pixels on the GPU — no tile server involved
  return new RasterLayer({
    id: options.id,
    // ... configure based on deck.gl-raster's actual API
  });
}
```
- Need to verify deck.gl-raster's actual API — the package may use a different layer class name or configuration pattern. Read the README before implementing.

**`frontend/src/lib/maptool/index.ts`**
- Export `createDirectCOGLayer` alongside existing `createCOGLayer`

**`frontend/src/components/DirectRasterMap.tsx`** (new file)
- New component mirroring `RasterMap.tsx` but using `createDirectCOGLayer` instead of `createCOGLayer`
- Shares the same basemap, colormap selector, band selector, and opacity controls
- Accepts the COG's direct S3 URL (from `dataset.s3_href` or similar) instead of a tile URL
- Colormap and band changes update the layer props without any network request — deck.gl-raster re-renders from cached pixel data on the GPU

**`frontend/src/components/RasterDatasetView.tsx`** (new or modified — wherever the raster detail page lives)
- Add a tab bar with "Tile Server" and "Client Rendering" tabs
- Both tabs share viewport state (synced via `onViewStateChange` callbacks) so switching tabs preserves the map position
- "Tile Server" tab renders the existing `RasterMap`
- "Client Rendering" tab renders the new `DirectRasterMap`
- Pattern should match how vector datasets handle the PMTiles/GeoParquet tab switch

**Backend: expose the direct COG URL to the frontend**

Currently `dataset.tile_url` points to the titiler tile endpoint. The frontend also needs the raw S3 URL so deck.gl-raster can fetch the COG directly.

**`ingestion/src/services/stac_ingest.py`** (or wherever dataset responses are built)
- Add a `cog_url` field to the dataset response that points to the MinIO-hosted COG
- This needs to use the public-facing MinIO URL (port 9000), not the Docker-internal one
- Example: `http://localhost:9000/sandbox-data/{dataset_id}.tif`

**`frontend/src/types.ts`**
- Add `cog_url?: string` to the `Dataset` type

**CORS on MinIO**
- deck.gl-raster will make HTTP Range requests directly from the browser to MinIO
- MinIO needs CORS configured to allow requests from `localhost:5185`
- Add CORS policy to the `minio-init` service in `docker-compose.yml`:
```bash
mc anonymous set download myminio/sandbox-data
# or configure a proper CORS policy
```

### What this does NOT cover

- **Temporal datasets**: deck.gl-raster reads individual COG files, not STAC collections with temporal queries. The "Client Rendering" tab would only work for static (single-timestep) rasters initially. Temporal support could come later by switching between COG URLs per timestep.
- **Replacing titiler**: This is a comparison mode, not a replacement. Titiler remains the default and handles STAC collection tiling, temporal stacks, and advanced rendering (rescaling, band math expressions) that deck.gl-raster doesn't support.

### Risk

Medium. The main unknowns are:
1. **deck.gl-raster's current API** — the package may have evolved since it was last actively developed. Need to check if it's compatible with deck.gl v9 (which the frontend currently uses).
2. **MinIO CORS** — browser-to-MinIO Range requests may need careful CORS configuration.
3. **Large COGs** — deck.gl-raster handles tiled COGs well but may struggle with untiled or very large files. The sandbox already converts everything to tiled COGs, so this should be fine.

Suggest a spike first: install deck.gl-raster, try rendering a single COG from MinIO, and verify deck.gl v9 compatibility before building out the full tab UI.

---

## Execution Order

1. **rio-stac + pystac** first — this is a pure backend refactor with no frontend changes. Reduces code, adds validation, and has the lowest risk.
2. **geojson-pydantic** second — small additive change that pairs naturally with the pystac work (both are about validation).
3. **deck.gl-raster spike** third — verify deck.gl v9 compatibility and MinIO CORS before committing to the full UI work.
4. **deck.gl-raster full integration** last — build the comparison tabs once the spike confirms viability.
