# Skill: GeoJSON to GeoParquet

## When to use

When you have a GeoJSON file and need to convert it to GeoParquet for efficient columnar storage, smaller file sizes, and cloud-native access.

## Prerequisites

- Python 3.10+
- `pip install geopandas pyarrow shapely numpy`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a GeoJSON file to GeoParquet |
| [`scripts/validate.py`](scripts/validate.py) | Validate that GeoParquet preserves all data from the source GeoJSON |

## Quickstart

    pip install geopandas pyarrow shapely numpy
    python scripts/convert.py --input data.geojson --output data.parquet
    python scripts/validate.py --input data.geojson --output data.parquet

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input .geojson or .json file |
| `--output` | Yes | — | Path for output .parquet file |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original GeoJSON (omit for self-test) |
| `--output` | No | — | Path to converted GeoParquet (omit for self-test) |

When both `--input` and `--output` are omitted, runs a self-test that generates synthetic data, converts it, and validates the result.

## Known failure modes

- Comparing CRS via `str(crs)` fails because GeoJSON and GeoParquet serialize the same CRS differently (e.g. "EPSG:4326" vs full PROJJSON). Must use pyproj CRS equality (`src.crs == dst.crs`).
- **Uppercase column names break PostgreSQL/tipg**: Some GeoJSON files (e.g. Natural Earth data) use uppercase property names. tipg queries columns without quoting, causing `column "NAME" does not exist` errors at tile-serve time. Fix: `convert.py` now lowercases all column names at read time (`gdf.columns = [c.lower() for c in gdf.columns]`). Validation checks are case-insensitive for column matching and attribute fidelity so they don't false-fail after the rename.
- **Complex polygons cause `ST_AsMVT tolerance condition error (-20)` and MapLibre vertex errors**: High-vertex polygon datasets (e.g. Natural Earth 1:10m countries) cause two related failures: (1) PostGIS `ST_AsMVT` internally calls `ST_Simplify`, which overflows when vertex density is too high relative to tile extent, returning HTTP 500; (2) MapLibre GL JS has a hard limit of 65535 vertices per tile bucket — tiles exceeding this silently drop features, so data only appears when zoomed in enough that fewer features fit per tile. Console shows `"Max vertices per segment is 65535: bucket requested N"`. Fix: pre-simplify non-point geometries in `sandbox/ingestion/src/services/vector_ingest.py` before `to_postgis()` — `gdf.geometry.simplify(0.05, preserve_topology=True)`. A 0.001° tolerance is insufficient for world-scale datasets; 0.01° (~1km) stays within both limits at all zoom levels. Side effect: polygons smaller than ~1km collapse to point geometry and render as MapLibre circles; this is visually accurate at global zoom levels.

  **Note:** The CNG Sandbox ingestion pipeline avoids this entirely by routing polygon/line datasets through tippecanoe → PMTiles instead of PostGIS. This failure mode only applies when loading directly into PostGIS.
- **tipg catalog race causes browser-cached 404s**: The sandbox pipeline wrote the PostGIS table and immediately reported the job as `ready`, but tipg's `TIPG_CATALOG_TTL` (default 5 s) hadn't elapsed yet. The frontend loaded the map, MapLibre fetched tiles, and tipg returned `404 {"detail":"Collection not found"}` with `Cache-Control: max-age=3600`. The browser cached that 404 for one hour, making tiles permanently invisible without a hard-refresh. Fix (two parts): (1) `pipeline.py` now polls `GET /collections/{id}` on tipg and waits for 200 before marking ready; (2) Vite proxy overrides `Cache-Control: no-store` on all `/vector` responses so transient errors never stick.

## Changelog

- 2026-03-15: Removed check_geometry_complexity from run_checks() — pipeline routes polygon/line data through PMTiles, so the PostGIS vertex limit check is irrelevant there. Function still exists for direct PostGIS ingestion callers.
- 2026-03-15: Updated simplification tolerance to 0.01° to also prevent MapLibre "Max vertices per segment is 65535" errors at low zoom levels. Documented both failure modes together.
- 2026-03-15: Documented `ST_AsMVT tolerance condition error` and tipg catalog race / cached-404 failure modes.
- 2026-03-14: Moved lowercase-column fix into convert.py (applied at read time, not ingest time); updated validation checks to be case-insensitive for column matching and attribute fidelity.
- 2026-03-14: Added lowercase column name validation check (PostgreSQL/tipg compatibility).
- 2026-03-13: Fixed CRS comparison in validate.py — use pyproj equality instead of string comparison.
