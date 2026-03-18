# Geospatial File Conversion Skills

Standalone Python utilities for converting legacy geospatial formats to cloud-native equivalents. Each skill is independently distributable — copy a single skill folder to any machine with Python 3.10+ and use it directly.

## Skills

| Skill | Input | Output |
|-------|-------|--------|
| `geotiff-to-cog` | GeoTIFF (.tif, .tiff) | Cloud-Optimized GeoTIFF |
| `shapefile-to-geoparquet` | Shapefile (.shp + companions) | GeoParquet (.parquet) |
| `geojson-to-geoparquet` | GeoJSON (.geojson, .json) | GeoParquet (.parquet) |
| `netcdf-to-cog` | NetCDF (.nc, .nc4) | Cloud-Optimized GeoTIFF |

## Why these matter

Geospatial format conversion is deceptively error-prone. Mainstream tools like raw rasterio, DuckDB, and gpq can silently produce degraded output — invalid COG byte ordering, renamed geometry columns, coerced data types, or outright conversion failures. These problems are invisible in desktop GIS but break cloud-native workflows (tile servers, web maps, automated pipelines).

Each skill pairs a **converter** (using a validated tool) with a **validator** that checks 8-9 properties of the output against the source: CRS, bounds, dimensions, pixel/geometry fidelity, metadata compliance, and more. The validators caught real defects in 3 out of 5 tools tested in a [shootout against mainstream alternatives](../../docs/shootout/results/findings.md).

## Usage pattern

Each skill has the same interface:

1. Install dependencies: `pip install <packages listed in SKILL.md>`
2. Convert: `python scripts/convert.py --input <source> --output <destination>`
3. Validate: `python scripts/validate.py --input <source> --output <destination>`

Run `python scripts/validate.py` with no arguments to execute a self-test.

## Installation (for programmatic use)

```bash
pip install -e "skills/geo-conversions[all]"
```

Then import from anywhere:

```python
from geotiff_to_cog import convert, run_checks
from netcdf_to_cog import convert, run_checks
```

## Unified CLI

Auto-detects format from the input file extension:

```bash
python skills/geo-conversions/cli.py convert <input> <output> [--verbose]
python skills/geo-conversions/cli.py validate <input> <output>
```

Or, after `pip install -e`:

```bash
cng convert <input> <output> [--verbose]
cng validate <input> <output>
```

NetCDF-specific flags: `--variable <name>`, `--time-index <int>`.

## Programmatic use

```python
from geotiff_to_cog import run_checks

results = run_checks("input.tif", "output.tif")
for check in results:
    print(f"{check.name}: {'PASS' if check.passed else 'FAIL'} — {check.detail}")
```
