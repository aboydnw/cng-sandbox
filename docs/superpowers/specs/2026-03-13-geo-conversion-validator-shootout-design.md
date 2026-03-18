# Geo Conversion Validator Shootout — Design Spec

## Objective

Prove that our `validate.py` scripts catch real data quality problems that mainstream geospatial conversion tools silently produce. Run real-world test files through multiple conversion tools, grade each tool's output with our validators, and document findings.

**Success criteria:** At least 3 cases where a mainstream tool silently produces degraded output, our validator catches it, and the degradation would cause real downstream problems.

## Scope

- **In scope:** Running external tools, grading their output with our validators, fixing false positives in our validators if found, documenting results
- **Out of scope:** Modifying external tools, adding new validator features (severity levels, strict/permissive mode — those are future work), synthetic test data generation

## Directory Structure

```
docs/shootout/
├── run_shootout.py              # Single entry point
├── converters/
│   ├── __init__.py
│   ├── base.py                  # ConverterResult dataclass, common interface
│   ├── raster_rio_cogeo.py      # Our baseline
│   ├── raster_gdal.py           # gdal_translate -of COG
│   ├── raster_rasterio_raw.py   # Manual tiling (known to fail)
│   ├── raster_cogger.py         # Rust-based, best-effort install
│   ├── vector_geopandas.py      # Our baseline
│   ├── vector_gpq.py            # Planet Labs Go binary (GeoJSON only)
│   ├── vector_ogr2ogr.py        # GDAL ogr2ogr -f Parquet
│   └── vector_duckdb.py         # DuckDB spatial extension
├── data/                        # Downloaded test files (cached, .gitignored)
├── results/
│   ├── raw/                     # Per-run JSON: {converter}_{testfile}.json
│   │   └── outputs/             # Conversion output files (kept for inspection)
│   ├── raster_matrix.md         # Rendered pass/fail grid
│   ├── vector_matrix.md         # Rendered pass/fail grid
│   └── findings.md              # Hand-written narrative analysis
└── README.md                    # How to reproduce
```

## Test Data

All real-world files. No synthetic data.

### Raster (GeoTIFF)

| # | File | Characteristics | Source |
|---|------|----------------|--------|
| 1 | Natural Earth 50m Shaded Relief (color) | RGB uint8, ~170MB | `https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip` |
| 2 | NASA NEO Sea Surface Temperature | Single-band float32, nodata over land, ~220KB | `https://neo.gsfc.nasa.gov/archive/geotiff/MWOI_SST_M/MWOI_SST_M_2024-01.TIFF` |
| 3 | Natural Earth 50m Shaded Relief (gray) | RGB uint8, ~10MB | `https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip` |

### Shapefile

| # | File | Geometry | Features | Location |
|---|------|----------|----------|----------|
| 1 | NASA FIRMS 24h fires | Points | ~64K | `docs/geo-conversion-test-results/test-2-real-data/firms_shp/` |
| 2 | HydroRIVERS Greenland | LineStrings | ~137K | `HydroRIVERS_v10_gr_shp/` |
| 3 | Natural Earth 110m Countries | MultiPolygons | ~177 | `https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip` |

### GeoJSON

| # | File | Geometry | Features | Location |
|---|------|----------|----------|----------|
| 1 | USGS Earthquakes | Points (3D) | ~10K | `docs/geo-conversion-test-results/test-2-real-data/earthquakes.geojson` |
| 2 | Natural Earth 50m Countries | MultiPolygons | ~240 | `https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson` |
| 3 | Natural Earth 50m Rivers | LineStrings | ~470 | `https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines.geojson` |

## Conversion Tools

### Raster (GeoTIFF to COG)

| Tool | Install | Notes |
|------|---------|-------|
| rio-cogeo | `pip install rio-cogeo` | Our baseline converter |
| GDAL | `apt install gdal-bin` | `gdal_translate -of COG` |
| rasterio (raw) | `pip install rasterio` | Manual tiling, known to produce invalid COGs |
| cogger | `pip install cogger` or `cargo install cogger` | Rust-based, skip if not installable ([GitHub](https://github.com/GiorgioAlberworktree/cogger)) |

### Vector (Shapefile/GeoJSON to GeoParquet)

| Tool | Install | Shapefile | GeoJSON | Notes |
|------|---------|-----------|---------|-------|
| geopandas | `pip install geopandas pyarrow` | Yes | Yes | Our baseline converter |
| gpq | Download binary from GitHub releases | **No** | Yes | GeoJSON-only; skip for Shapefile inputs |
| ogr2ogr | `apt install gdal-bin` | Yes | Yes | `ogr2ogr -f Parquet` |
| DuckDB | `pip install duckdb` + spatial extension | Yes | Yes | SQL-based conversion |

## Converter Interface

Each converter module exports:

```python
def convert(input_path: Path, output_path: Path) -> ConverterResult
```

`ConverterResult` is a dataclass:

```python
@dataclasses.dataclass
class ConverterResult:
    tool: str                  # e.g., "gdal", "gpq"
    status: str                # "success", "error", "skipped"
    error_message: str | None  # stderr or exception message
    duration_seconds: float
```

If a tool is not installed, `convert()` returns `ConverterResult(status="skipped")` without raising.

## Validator Refactoring

Minimal change to the three existing `validate.py` scripts:

**Add** a `run_checks(input_path, output_path) -> list[CheckResult]` function that:
- Accepts file paths (not pre-loaded data) so the runner can call all validators uniformly
- Handles loading internally (rasterio for raster, geopandas for vector)
- Returns structured results

```python
@dataclasses.dataclass
class CheckResult:
    name: str          # e.g., "crs_match", "pixel_fidelity" (matches existing field name)
    passed: bool
    detail: str        # human-readable explanation
```

Note: The existing validators already define a `CheckResult` namedtuple with fields `(name, passed, detail)`. The refactoring replaces the namedtuple with a dataclass using the same field names for compatibility.

**Keep** the existing `run_validation()` CLI entry point as a thin wrapper that calls `run_checks()`, prints formatted output, and exits.

No other validator changes unless a false positive is discovered during the shootout.

## Runner Logic (run_shootout.py)

### Phase 1 — Acquire test data

- Check for local files; download missing ones (Natural Earth ZIPs, NASA NEO TIFF, GeoJSON URLs)
- Unzip as needed
- Skip the run if a required file can't be obtained

### Phase 2 — Run conversions

The runner defines two test registries:

```python
RASTER_TESTS = [
    {"name": "ne_color", "path": "...", "converters": [rio_cogeo, gdal, rasterio_raw, cogger]},
    ...
]
VECTOR_TESTS = [
    {"name": "firms", "format": "shapefile", "path": "...", "converters": [geopandas, ogr2ogr, duckdb]},
    {"name": "earthquakes", "format": "geojson", "path": "...", "converters": [geopandas, gpq, ogr2ogr, duckdb]},
    ...
]
```

The `format` field determines which validator to use: `"shapefile"` routes to `shapefile-to-geoparquet/scripts/validate.py`, `"geojson"` routes to `geojson-to-geoparquet/scripts/validate.py`. Raster tests always use `geotiff-to-cog/scripts/validate.py`. The `converters` list controls which tools run against each file (e.g., `gpq` is excluded from Shapefile tests).

For each `(test_file, converter)` pair:

1. Create output path in `results/raw/outputs/` (not a temp dir — kept for inspection, cleaned manually)
2. Call `converter.convert(input, output)` — capture result
3. If conversion succeeded, import the appropriate `validate.py` and call `run_checks(input, output)`
4. Save combined result as JSON to `results/raw/{converter}_{testfile}.json`
5. Continue to next pair regardless of failures

Result JSON schema:

```json
{
  "converter": "gdal",
  "test_file": "ne_color",
  "input_path": "/path/to/input.tif",
  "output_path": "/path/to/output.tif",
  "conversion": {
    "status": "success",
    "error_message": null,
    "duration_seconds": 12.3
  },
  "checks": [
    {"name": "cog_valid", "passed": true, "detail": "Valid COG structure"},
    {"name": "crs_match", "passed": false, "detail": "CRS mismatch: EPSG:4326 vs None"}
  ]
}
```

### Phase 3 — Render reports

- Read all JSON from `results/raw/`
- Build `raster_matrix.md` and `vector_matrix.md` — pass/fail grids
- Print summary to stdout

## Comparison Criteria

### Per-check results

Each `CheckResult` has a boolean `passed` field (PASS or FAIL). The ERROR and SKIP states exist only at the `ConverterResult` level — if a converter errors or is skipped, no checks are run and no `CheckResult`s are produced for that run.

### Failure classification (manual, post-run)

| Classification | Meaning | Action |
|---|---|---|
| **Real defect** | Tool silently broke something, our validator caught it | Document as a finding |
| **False positive** | Our validator is too strict or wrong | Fix our validator |
| **Expected limitation** | Known lossy behavior (e.g., shapefile 10-char column truncation) | Document but don't count toward success criteria |

### Severity (for real defects only)

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | Data loss or corruption | Wrong pixel values, dropped features, broken CRS |
| **Warning** | Degraded but usable | Minor precision loss, missing metadata |
| **Info** | Cosmetic | Different but equivalent representations |

## Output Artifacts

### In-repo (`docs/shootout/results/`)

- `raw/*.json` — one file per (converter, test_file) run
- `raster_matrix.md` — pass/fail grid for raster tools
- `vector_matrix.md` — pass/fail grid for vector tools
- `findings.md` — narrative analysis: each failure classified, severity assigned, downstream impact described, validator improvement proposals

### Obsidian (`~/Documents/obsidian-notes/Project Docs/Map App Builder/`)

- Copy of `findings.md` (narrative only, not raw data)

## Decisions

- **Best-effort tool installation:** Skip tools that won't install cleanly, document what was skipped
- **Fix false positives during shootout:** If our validators produce false positives, fix them so results are accurate
- **No new validator features:** Severity levels, strict/permissive mode, and new checks are future work — only documented as proposals in findings
- **Real data only:** No synthetic test files; real-world data is a more useful test
- **Manual classification:** The automated run produces the raw matrix; failure classification and narrative analysis are done manually (i.e., `findings.md` is hand-written after reviewing the automated results, not generated by `run_shootout.py`)
- **Per-conversion timeout:** 5-minute timeout per conversion to prevent a hanging tool from blocking the entire run
- **Output files kept for inspection:** Conversion outputs are stored in `results/raw/outputs/` rather than a temp dir, so they can be manually inspected after the run; clean up manually when done
- **Downloaded test data cached:** Downloaded files are stored in `docs/shootout/data/` and reused across runs; re-download only if missing
