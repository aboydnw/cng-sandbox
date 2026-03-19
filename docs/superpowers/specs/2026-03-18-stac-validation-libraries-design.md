# Design: Replace Hand-Rolled STAC with rio-stac + pystac + geojson-pydantic

**Date:** 2026-03-18
**Scope:** Backend only (ingestion service)
**Risk:** Low

## Problem

`ingestion/src/services/stac_ingest.py` manually constructs STAC collections and items as raw Python dicts (~140 lines). Geometry is built by hand (bbox to polygon coordinate list), metadata extraction duplicates work done upstream in the pipeline, and nothing validates the output against the STAC or GeoJSON specs before POSTing to the Transaction API. A malformed item won't be caught until pgSTAC rejects it.

Separately, uploaded GeoJSON files pass through to GeoPandas without schema validation. A file with an unclosed ring or missing `type` field produces a cryptic traceback instead of a clear error.

## Solution

Replace the hand-rolled STAC construction with three DS-maintained libraries:

- **rio-stac** generates spec-compliant STAC items directly from COG files (bounds extraction, CRS reprojection, geometry construction, asset creation)
- **pystac** provides typed Collection/Item objects with built-in `.validate()` and `.to_dict()`
- **geojson-pydantic** validates GeoJSON geometries via Pydantic models

## Dependencies

Add to `ingestion/pyproject.toml`:

```
rio-stac >= 0.10.0
pystac >= 1.10.0
geojson-pydantic >= 1.1.0
```

## Changes

### stac_ingest.py — rewrite

**Functions deleted:**
- `get_cog_metadata()` — rio-stac extracts spatial metadata internally
- `build_collection()` — replaced by `pystac.Collection()`
- `build_item()` — replaced by `rio_stac.create_stac_item()`
- `build_temporal_collection()` — replaced by `pystac.Collection()`
- `build_temporal_item()` — replaced by `rio_stac.create_stac_item()`

**`ingest_raster()` new flow:**
1. `create_stac_item(source=cog_path, id=f"{dataset_id}-data", collection=f"sandbox-{dataset_id}", asset_href=s3_href, asset_media_type="image/tiff; application=geotiff; profile=cloud-optimized", asset_roles=["data"])` — produces a `pystac.Item`
2. Validate geometry: `Polygon.model_validate(item.geometry)` (geojson-pydantic safety net)
3. Build `pystac.Collection` from the item's bbox and datetime
4. `collection.validate()` and `item.validate()` before POSTing
5. POST `collection.to_dict()` and `item.to_dict()` via httpx (same logic as today)

Signature unchanged: `(dataset_id, cog_path, s3_href, filename)`.

**`ingest_temporal_raster()` new flow:**
1. For each timestep COG: `create_stac_item(source=cog_path, id=f"{dataset_id}-{i}", collection=f"sandbox-{dataset_id}", input_datetime=datetime.fromisoformat(dt), asset_href=s3_href, asset_media_type="image/tiff; application=geotiff; profile=cloud-optimized", asset_roles=["data"])` — datetime comes from upstream NetCDF parsing
2. Validate each item's geometry with geojson-pydantic
3. Build `pystac.Collection` using first item's bbox and full datetime range
4. Validate all objects, POST as today

**Signature change:** Drop the `bbox` parameter. rio-stac extracts bbox from each COG directly. New signature: `(dataset_id, cog_paths, s3_hrefs, filename, datetimes)`.

**Note on COG reads:** rio-stac opens each COG to read its TIFF header (~1-2 small reads). This is negligible I/O — COGs are designed for random access, and the header read is microseconds on local disk. For temporal datasets, the COG paths are local files inside a `tempfile.TemporaryDirectory` context — rio-stac reads them before the tempdir is cleaned up (the `ingest_temporal_raster()` call is inside the `with` block in `temporal_pipeline.py`).

**Import cleanup:** After the rewrite, `stac_ingest.py` no longer needs `import rasterio` or `from rasterio.warp import transform_bounds`. rasterio remains a transitive dependency via rio-stac (and via cng-toolkit).

### temporal_pipeline.py — drop bbox arg

The actual caller of `ingest_temporal_raster()` is `temporal_pipeline.py`, not `pipeline.py`. At line 138, update the call to drop the `bbox=bounds` keyword argument:

```python
# Before (line 138-145):
tile_url = await stac_ingest.ingest_temporal_raster(
    dataset_id=job.dataset_id,
    cog_paths=cog_paths,
    s3_hrefs=s3_hrefs,
    filename=display_name,
    bbox=bounds,
    datetimes=datetimes,
)

# After:
tile_url = await stac_ingest.ingest_temporal_raster(
    dataset_id=job.dataset_id,
    cog_paths=cog_paths,
    s3_hrefs=s3_hrefs,
    filename=display_name,
    datetimes=datetimes,
)
```

No other changes to `temporal_pipeline.py`. The `bounds` variable is still computed (line 118) and used for the `Dataset` record (line 161) — only the STAC ingestion no longer needs it.

### pipeline.py — add GeoJSON validation

Add GeoJSON structure validation in the **validating stage** of `run_pipeline()`. Insert after the validation failure early-return (line 181) and before bounds extraction (line 183). For GeoJSON uploads only (`format_pair == FormatPair.GEOJSON_TO_GEOPARQUET`), read the input file and validate:

```python
# After the validation failure early-return (line 181), before bounds extraction (line 183)
if format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
    from geojson_pydantic import FeatureCollection
    from pydantic import ValidationError
    from pathlib import Path
    geojson_bytes = Path(input_path).read_bytes()
    try:
        FeatureCollection.model_validate_json(geojson_bytes)
    except ValidationError as e:
        job.status = JobStatus.FAILED
        job.error = f"Invalid GeoJSON structure: {e}"
        return
```

This runs on the original input file (not the converted output), during the validating stage, after cng-toolkit's own checks. It catches structural GeoJSON issues (missing `type`, malformed coordinates) that cng-toolkit's format-specific checks may not cover.

**Memory note:** GeoJSON files are fully loaded into memory for validation. This is acceptable — the sandbox already loads GeoJSON into GeoPandas during conversion, which has the same memory footprint. Very large files (100MB+) are already handled by the existing upload size limits.

### What doesn't change

- **Pipeline orchestration:** Scan → convert → validate → ingest → ready stages unchanged
- **httpx POST logic:** Same endpoints, same error handling, same 409 tolerance for collections
- **Tile URL construction:** Return values (tile URL templates) unchanged
- **Frontend:** Zero changes — consumes tile URLs and dataset metadata, none of which change
- **Docker/config:** No new services, no env var changes
- **Other ingest services:** `vector_ingest.py` and `pmtiles_ingest.py` untouched

## Tests

### test_stac_ingest.py — rewrite

Delete existing tests for the removed helper functions. Replace with:

1. **`test_ingest_raster_builds_valid_stac`** — Create a tiny COG fixture (4x4 pixel GeoTIFF via rasterio), build pystac Collection + Item via rio-stac, assert `.validate()` passes and `.to_dict()` has correct collection ID, asset href, media type, bbox
2. **`test_ingest_temporal_builds_valid_stac`** — Multiple COG fixtures with explicit datetimes. Assert temporal extent spans full range, each item has correct datetime
3. **`test_geometry_is_valid_geojson`** — After building an item, assert `Polygon.model_validate(item.geometry)` succeeds

### test_pipeline.py — add 2 tests

4. **`test_invalid_geojson_rejected`** — Pass malformed GeoJSON bytes (unclosed ring, missing `type`), assert validation raises with user-facing error
5. **`test_valid_geojson_accepted`** — Pass well-formed FeatureCollection bytes, assert no error

All tests use real fixtures (rasterio-generated GeoTIFFs, raw GeoJSON bytes), not mocks.

## Scope summary

| What | Change |
|------|--------|
| `ingestion/pyproject.toml` | 3 new dependencies |
| `ingestion/src/services/stac_ingest.py` | Rewrite: ~140 lines → ~60 lines |
| `ingestion/src/services/temporal_pipeline.py` | Drop `bbox` arg from `ingest_temporal_raster()` call |
| `ingestion/src/services/pipeline.py` | Add GeoJSON validation in validating stage |
| `ingestion/tests/test_stac_ingest.py` | Rewrite: 4 old tests → 3 new tests |
| `ingestion/tests/test_pipeline.py` | Add 2 new validation tests |
| Frontend | No changes |
| Docker/config | No changes |
