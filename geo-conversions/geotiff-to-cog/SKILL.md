# Skill: GeoTIFF to Cloud-Optimized GeoTIFF

## When to use

When you have a GeoTIFF file and need to convert it to a Cloud-Optimized GeoTIFF (COG) for efficient cloud-based access, tiling, and visualization.

## Prerequisites

- Python 3.10+
- `pip install rasterio rio-cogeo numpy`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a GeoTIFF to COG with configurable compression |
| [`scripts/validate.py`](scripts/validate.py) | Validate that a COG preserves all data from the source GeoTIFF |

## Quickstart

Install dependencies, convert a file, and validate the result:

    pip install rasterio rio-cogeo numpy
    python scripts/convert.py --input data.tif --output data_cog.tif
    python scripts/validate.py --input data.tif --output data_cog.tif

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input GeoTIFF |
| `--output` | Yes | — | Path for output COG |
| `--compression` | No | `DEFLATE` | Compression method: DEFLATE, ZSTD, or LZW |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original GeoTIFF (omit for self-test) |
| `--output` | No | — | Path to converted COG (omit for self-test) |

When both `--input` and `--output` are omitted, runs a self-test that generates synthetic data, converts it, and validates the result.

## Known failure modes

- Writing tiled GeoTIFFs with overviews directly via `rasterio.open()` does NOT produce valid COGs — the IFD ordering will be wrong. Must use `rio-cogeo`'s `cog_translate` function.
- **Projected CRS bounds not compatible with STAC**: COGs with projected CRS (e.g. UTM, Albers) have bounds in meters, not degrees. STAC requires WGS84 bounding boxes. Downstream ingest must reproject bounds via `rasterio.warp.transform_bounds(src.crs, "EPSG:4326", *src.bounds)`. Without this, titiler-pgstac returns 204 (empty tiles) because the STAC item bbox doesn't intersect any web mercator tiles. The validate script now warns about this.
- **Polar CRS datasets produce out-of-range WGS84 bounds**: Polar projections (e.g. EPSG:3412 South Polar Stereographic, EPSG:3413 North Polar Stereographic) produce WGS84 bounds where `south=-90` or `north=90` after `transform_bounds`. Web Mercator is undefined at the poles (latitude maps to ±infinity). Passing these bounds directly to `WebMercatorViewport.fitBounds` in deck.gl produces NaN viewport values, causing the map layer to fail silently — no tiles are ever requested, the map appears blank with no console error about tiles. Fix: clamp bounds to `±85.051129°` (the valid Mercator range) before calling `fitBounds`. The validate script now flags this with `check_mercator_bounds`.

## Changelog

- 2026-03-14: Added `check_mercator_bounds` to flag polar datasets whose WGS84 bounds exceed ±85.051129°. Documented that downstream map viewers (deck.gl `WebMercatorViewport`) must clamp bounds before `fitBounds`.
- 2026-03-14: Added WGS84 bounds compatibility check for projected CRS datasets. Documented STAC bounds reprojection requirement.
- 2026-03-13: Switched convert.py from manual rasterio tiled write to `cog_translate` — fixes COG structure validation failure caused by incorrect IFD ordering.
