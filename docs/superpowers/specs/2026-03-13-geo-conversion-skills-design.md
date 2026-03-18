# Geospatial File Conversion Skills — Design Spec

## Context

Scientists and developers need to convert legacy geospatial formats (GeoTIFF, Shapefile, GeoJSON) into cloud-native equivalents (Cloud-Optimized GeoTIFF, GeoParquet) before using them in modern visualization and analysis workflows. These skills provide standalone, portable Python conversion utilities with built-in validation to guarantee data fidelity.

Each skill is independently distributable — a scientist can copy a single skill folder to their machine and use it without this repository or any pre-existing infrastructure.

---

## Skills

| Skill | Input | Output |
|---|---|---|
| `geotiff-to-cog` | GeoTIFF (.tif, .tiff) | Cloud-Optimized GeoTIFF |
| `shapefile-to-geoparquet` | Shapefile (.shp + companions) | GeoParquet (.parquet) |
| `geojson-to-geoparquet` | GeoJSON (.geojson, .json) | GeoParquet (.parquet) |

Build order: geotiff-to-cog first (lowest risk, proves the pattern), then both vector skills.

---

## Folder Structure

```
skills/
  geo-conversions/
    README.md
    geotiff-to-cog/
      SKILL.md
      scripts/
        convert.py
        validate.py
    shapefile-to-geoparquet/
      SKILL.md
      scripts/
        convert.py
        validate.py
    geojson-to-geoparquet/
      SKILL.md
      scripts/
        convert.py
        validate.py
```

Each skill folder is fully self-contained. No shared modules across skills. No committed binary test files — `validate.py` generates synthetic test data programmatically.

---

## SKILL.md Convention

Follows the existing pattern from `ingest-stac-data`. Each SKILL.md contains:

1. **When to use** — one-liner describing the conversion
2. **Prerequisites** — Python 3.10+, pip packages listed
3. **Template files** — table of scripts with purpose descriptions
4. **Quickstart** — 3 commands: pip install, convert, validate
5. **CLI flags** — table of all arguments
6. **Known failure modes** — populated during development loop
7. **Changelog** — updated during development loop

---

## CLI Interface

Consistent across all three skills:

### convert.py

```
python convert.py --input <path> --output <path> [--overwrite] [--verbose]
```

Skill-specific flags:
- `geotiff-to-cog`: `--compression {DEFLATE,ZSTD,LZW}` (default: DEFLATE)
- `shapefile-to-geoparquet`: `--input` points to the `.shp` file; companion files (`.dbf`, `.shx`, `.prj`) are resolved automatically from the same directory

Behavior:
- Checks for required packages at import time; prints `pip install` command if missing
- Validates input file exists and is the correct format before starting
- Progress output for large files
- Actionable error messages, non-zero exit on failure
- Prints output path and file size on success

### validate.py

```
python validate.py --input <original> --output <converted>
python validate.py  # self-test mode: generates synthetic data, converts, validates
```

- Checks for required packages at import time; prints `pip install` command if missing
- Runs the full validation suite (see below)
- Prints a pass/fail report with check names and details
- Exits non-zero if any check fails

---

## Dependencies

### geotiff-to-cog
- `rasterio`, `rio-cogeo`, `numpy`

### shapefile-to-geoparquet
- `geopandas`, `pyarrow`, `shapely`

### geojson-to-geoparquet
- `geopandas`, `pyarrow`, `shapely`

All install cleanly via `pip`. GDAL is bundled in the `rasterio` and `fiona` (geopandas backend) wheels — no system-level GDAL installation required.

---

## Validation Suite

Each `validate.py` contains its own check functions and report printer inline (no shared module). Each check returns a named result with pass/fail status and detail string.

### Raster Checks (geotiff-to-cog)

| Check | Method | Pass Condition |
|---|---|---|
| COG structure valid | `rio-cogeo validate` | Reports valid=True |
| CRS preserved | Compare EPSG codes | Exact match |
| Bounding box preserved | Compare bounds | Within 1e-6 degrees |
| Pixel dimensions | Compare width/height | Exact match |
| Band count | Compare band count | Exact match |
| Pixel value fidelity | Sample 1000 random pixels, compare | Max abs diff < 1e-4 (float), exact match (int) |
| NoData value preserved | Compare nodata attribute | Exact match |
| Overview levels present | Check internal overviews | At least 3 levels |

Tolerance rationale: floating-point rounding during compression is expected. 1e-4 catches actual data corruption while allowing DEFLATE/ZSTD precision handling. Integer data (classified rasters, masks) must be exact.

### Vector Checks (shapefile-to-geoparquet, geojson-to-geoparquet)

| Check | Method | Pass Condition |
|---|---|---|
| Row count preserved | Compare len(gdf) | Exact match |
| CRS preserved | Compare CRS string | Exact match |
| Column names preserved | Compare column sets | Exact match |
| Geometry type preserved | Compare geometry types | Exact match |
| Geometry validity | `gdf.geometry.is_valid.all()` | True |
| Geometry fidelity | Sample 100 random geometries, compare WKT | Exact match |
| Attribute fidelity | Sample 100 random rows, compare all fields | Exact match |
| Bounding box preserved | Compare total_bounds | Within 1e-8 degrees |
| GeoParquet spec compliance | Check parquet metadata for `geo` key | Present and valid |

---

## Development Method

Each skill is developed using the `ralph-loop` Claude Code plugin, which iterates autonomously:

1. Write initial SKILL.md, convert.py, validate.py
2. Install dependencies via pip
3. Run convert.py on synthetic test data
4. Run validate.py — check all pass conditions
5. If any fail: fix scripts, append to SKILL.md changelog, repeat from 2
6. If all pass: generate 2 more diverse synthetic inputs (different CRS, data types), run again
7. All 3 test files pass — skill is done

The validation pass conditions defined above are the contract — the loop may modify scripts and documentation but must not weaken the checks.

---

## Changes to Existing Files

- **`skills/README.md`** — add a new "Data conversion" section:

```markdown
## Data conversion

| Skill | Description |
|-------|-------------|
| `geotiff-to-cog` | Convert a GeoTIFF to a Cloud-Optimized GeoTIFF with validation |
| `shapefile-to-geoparquet` | Convert a Shapefile to GeoParquet with validation |
| `geojson-to-geoparquet` | Convert a GeoJSON file to GeoParquet with validation |
```

No other existing files are modified.

---

## Verification

For each skill, after development:

1. `python convert.py --input <synthetic> --output /tmp/out` — exits 0
2. `python validate.py --input <synthetic> --output /tmp/out` — all checks pass, exits 0
3. `python validate.py` (no args) — self-test generates data, converts, validates, all pass
4. Repeat with 2 additional synthetic datasets (different CRS, different data types)
