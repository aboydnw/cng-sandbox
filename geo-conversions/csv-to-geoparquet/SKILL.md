# Skill: CSV/TSV to GeoParquet

## When to use

When you have tabular point data in a CSV or TSV file — coordinates in
latitude/longitude columns, or geometries in a WKT column — and need it as
GeoParquet for map rendering and cloud-native access.

## Prerequisites

- Python 3.10+
- `pip install geopandas pandas pyarrow shapely pyproj`

## Approach

The user chooses which columns hold the geometry:

- **lat/lon**: build point geometry with `geopandas.points_from_xy(lon, lat)`.
- **WKT**: parse a single column with `geopandas.GeoSeries.from_wkt(...)`.

Set the source CRS (default `EPSG:4326`), reproject to `EPSG:4326` for storage,
lowercase all column names (tipg/PostgreSQL compatibility), then `to_parquet`.

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/validate.py`](scripts/validate.py) | Validate the converted GeoParquet output |

## Quickstart

    # Validate a converted GeoParquet:
    python scripts/validate.py --output output.parquet

## Known failure modes

- **Non-numeric coordinate cells**: A lat/lon column containing stray text
  (units, headers repeated mid-file, `"N/A"`) silently coerces to `NaN` under
  `pd.to_numeric(errors="coerce")` and produces `POINT (nan nan)` geometries
  rather than an error. Fix: after coercion, flag rows that were non-null in the
  source but `NaN` after coercion and raise a clear error naming the column.
  Genuinely blank cells are treated as missing geometry and dropped (counted),
  not errored.
- **Swapped lat/lon**: Users frequently map longitude to the latitude slot. A
  latitude outside `[-90, 90]` or longitude outside `[-180, 180]` almost always
  means the columns are swapped. Fix: range-check both columns and raise naming
  the offending one. The `check_coordinate_range` check catches this on the
  output too.
- **points_from_xy does not null out NaN rows**: `points_from_xy(nan, nan)`
  yields a non-null, non-empty `POINT (nan nan)`, so a naive
  `geometry.notna()` filter keeps garbage rows. Drop rows where the numeric lat
  or lon is `NaN` *before* building geometry, not after.
- **Missing CRS on GeoParquet**: Building a `GeoDataFrame` without passing `crs`
  leaves the output CRS-less; tipg and titiler then can't place features. Always
  set the source CRS at construction and reproject to EPSG:4326 for storage.
- **Uppercase column names break tipg/PostgreSQL**: Same failure as the other
  vector skills — tipg queries columns unquoted, so a `Name` column raises
  `column "name" does not exist` at tile-serve time. Lowercase all columns at
  write time.

## Changelog

- 2026-07-13: Initial skill. Validation checks: row count, GeoParquet metadata,
  EPSG:4326 CRS, geometry validity, coordinate range, lowercase columns.
  Documented non-numeric-coordinate, swapped-lat/lon, `points_from_xy` NaN,
  missing-CRS, and uppercase-column failure modes.
