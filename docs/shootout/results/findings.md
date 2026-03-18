# Validator Shootout Findings

## Summary

**Success criteria met.** We needed at least 3 cases where a mainstream tool silently produces degraded output and our validators catch it. We found **4 distinct real defects** across 2 tools (rasterio-raw and DuckDB), plus 1 tool (gpq) that failed entirely on all inputs.

**Additionally, we found and fixed 2 false positives** in our validators:
1. `check_geometry_validity` flagged invalid geometries inherited from the source
2. `check_attribute_fidelity` treated `None` and `nan` as different values

### Results at a glance

| Metric | Count |
|--------|-------|
| Total conversion runs | 29 |
| Successful conversions | 16 |
| Conversion errors (tool crashed) | 3 |
| Skipped (tool not installed) | 10 |
| Validation checks run | 140 |
| Check failures (real defects) | 9 |

## Findings

### Finding 1: rasterio-raw — Invalid COG structure (2 files)

- **Check:** COG structure
- **Classification:** Real defect
- **Severity:** Critical
- **Files affected:** ne_color (170MB RGB), ne_gray (10MB RGB)
- **Details:** Raw rasterio with manual tiling produces a GeoTIFF with overviews and tiles, but the internal byte ordering violates the COG spec. The IFD offset is at byte 50MB instead of <300 bytes, and overview blocks are in the wrong order. This means the file looks like a valid TIFF with overviews but is NOT a COG — HTTP range requests for tiles will fail or be extremely inefficient.
- **Downstream impact:** A map tile server (like TiTiler) serving this file over HTTP would need to read the entire file to find tiles, defeating the purpose of COG. Users would see slow map rendering or timeouts. The file silently appears to work in desktop GIS tools that read the whole file, making this a particularly dangerous failure.
- **Why our validator catches it:** The `check_cog_valid` check uses `rio_cogeo.cog_validate()`, which verifies the internal byte ordering required by the COG specification. Without this check, someone could use raw rasterio's `build_overviews()` thinking they've created a COG when they haven't.

### Finding 2: DuckDB — Column renaming (6 files)

- **Check:** Columns preserved
- **Classification:** Real defect
- **Severity:** Warning
- **Files affected:** All 6 vector files (firms, hydrorivers, ne_countries_shp, earthquakes, ne_countries_geojson, ne_rivers_geojson)
- **Details:** DuckDB's spatial extension renames the geometry column from `geometry` to `geom` and adds an `OGC_FID` column that doesn't exist in the source. This is consistent across all file types (Shapefile and GeoJSON).
- **Downstream impact:** Code that references `gdf["geometry"]` or `gdf.geometry` by name will break. The extra `OGC_FID` column adds unnecessary data. While tools like geopandas can still load the file using GeoParquet metadata to find the geometry column, any code with hardcoded column name references will fail silently or raise KeyError.
- **Why our validator catches it:** The `check_columns_match` check compares the exact column sets between source and output.

### Finding 3: DuckDB — Date type coercion (1 file)

- **Check:** Attribute fidelity
- **Classification:** Real defect
- **Severity:** Warning
- **Files affected:** firms (Shapefile with date columns)
- **Details:** DuckDB converts datetime values to date strings, changing `2026-03-12 00:00:00` to `2026-03-12`. While the date information is preserved, the type changes from datetime to string, which could break downstream type-sensitive code.
- **Downstream impact:** Pandas operations that expect datetime objects (like `.dt.year`, time-based filtering) would fail. The data is not lost, but the format change is silent and could cause runtime errors downstream.
- **Why our validator catches it:** The `check_attribute_fidelity` check compares actual values across sampled rows, detecting type coercion that wouldn't be visible in schema comparison alone.

### Finding 4: gpq — Complete conversion failure (3 files)

- **Check:** N/A (tool errored before validation)
- **Classification:** Real defect
- **Severity:** Critical
- **Files affected:** All 3 GeoJSON files (earthquakes, ne_countries_geojson, ne_rivers_geojson)
- **Details:** gpq v0.17.0 failed on all three GeoJSON inputs with "failed to create parquet schema after reading 100 features". This appears to be a schema inference limitation — gpq reads 100 features to infer the schema, but if feature properties are heterogeneous (different types or missing keys across features), it cannot determine a consistent schema.
- **Downstream impact:** gpq simply cannot convert these standard GeoJSON files. This is not a silent failure (it errors loudly), but it demonstrates why validation matters — a conversion pipeline using gpq would silently skip files or crash.
- **Note:** This is a tool-level failure, not something our validator catches post-conversion. However, a robust conversion skill needs to handle tool errors gracefully, which our converter wrappers do (returning `status="error"` instead of crashing).

## False Positives Found and Fixed

### False Positive 1: Geometry validity — inherited invalid geometries

**What happened:** `check_geometry_validity` only checked the output, flagging invalid geometries even when they existed in the source. The ne_50m_admin_0_countries.geojson file has 1 invalid geometry (a self-intersecting country polygon), which both geopandas and DuckDB faithfully preserved.

**Fix:** Changed `check_geometry_validity(dst)` to `check_geometry_validity(src, dst)`. The check now compares invalid counts and only fails if the converter *introduced* new invalid geometries.

### False Positive 2: Attribute fidelity — None vs NaN

**What happened:** DuckDB converts `None` values to `NaN` (both representing null). Our validator treated these as different values because `None != nan` in Python.

**Fix:** Added `_is_null()` helper that treats both `None` and `NaN` as null. The check now skips comparison when both values are null.

## Tools Skipped

| Tool | Reason |
|------|--------|
| GDAL (gdal_translate) | Not installed — requires `apt install gdal-bin` (no sudo access) |
| GDAL (ogr2ogr) | Same as above |
| cogger | Not available via pip or cargo on this system |

## Baseline Results

Both baseline tools (rio-cogeo for raster, geopandas for vector) passed all checks on all files, confirming they are reliable conversion choices for our skills.

## Validator Improvements Proposed

Based on this shootout, these improvements would strengthen the validators (future work, not implemented here):

1. **Severity levels** — Not all failures are equal. COG structure failure is critical; column renaming is a warning. Adding severity levels would let users distinguish between data-loss bugs and cosmetic differences.

2. **Column name normalization check** — DuckDB's `geometry` → `geom` rename is a common pattern across tools. A dedicated check for geometry column naming would provide a clearer error message than the generic "columns preserved" check.

3. **Type coercion detection** — The date→string coercion is subtle. A dedicated check comparing column dtypes between source and output would catch this pattern more precisely than the attribute fidelity sampling.

4. **Strict/permissive mode** — Some users may want to allow column additions (like `OGC_FID`) while flagging column removals. A configurable mode would make the validators more flexible.
