# Skill: NetCDF to Cloud-Optimized GeoTIFF

## When to use

When you have a NetCDF file (.nc, .nc4) containing gridded climate, weather, or environmental data and need to convert a single variable/timestep to a Cloud-Optimized GeoTIFF (COG) for efficient cloud-based access, tiling, and visualization.

## Prerequisites

- Python 3.10+
- `pip install xarray netcdf4 rasterio rio-cogeo numpy`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a NetCDF variable to COG with configurable compression |
| [`scripts/validate.py`](scripts/validate.py) | Validate that a COG preserves all data from the source NetCDF |

## Quickstart

Install dependencies, convert a file, and validate the result:

    pip install xarray netcdf4 rasterio rio-cogeo numpy
    python scripts/convert.py --input data.nc --output data_cog.tif --variable temperature
    python scripts/validate.py --input data.nc --output data_cog.tif --variable temperature

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input .nc file |
| `--output` | Yes | — | Path for output COG |
| `--variable` | No | first data var | NetCDF variable name to extract |
| `--time-index` | No | `0` | Timestep index for temporal variables |
| `--compression` | No | `DEFLATE` | Compression method: DEFLATE, ZSTD, or LZW |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original NetCDF (omit for self-test) |
| `--output` | No | — | Path to converted COG (omit for self-test) |
| `--variable` | No | first data var | NetCDF variable to validate against |
| `--time-index` | No | `0` | Timestep index to validate against |

When both `--input` and `--output` are omitted, runs a self-test that generates a synthetic NetCDF (2 variables, 3 timesteps), converts it, and validates the result.

## Known complexity

- **Multi-variable NetCDFs:** Only one variable is extracted per conversion. If no `--variable` is specified, the first data variable is used.
- **Temporal dimensions:** Only one timestep is extracted per conversion. Use `--time-index` to select.
- **CRS:** Assumed EPSG:4326. Most climate/weather NetCDFs use geographic coordinates. NetCDFs with projected CRS are not handled.
- **Dimension naming:** The converter recognizes common dimension names: `lat`/`latitude`/`y` and `lon`/`longitude`/`x`. Non-standard names will cause a clear error.

## Validation checks (8 total)

| Check | Pass Condition |
|-------|---------------|
| COG structure | rio-cogeo validate returns valid |
| CRS present | EPSG:4326 defined |
| Bounds match | COG bounds contain NetCDF cell centers |
| Dimensions | Pixel width/height match NetCDF grid |
| Band count | Exactly 1 band |
| Pixel fidelity | 1000 random samples, max diff < 1e-4 |
| NoData defined | nodata value is set |
| Overviews | >= 3 internal overview levels |

## Known failure modes

- **NetCDF4 / HDF5 MIME type rejection**: NetCDF4 files are built on the HDF5 format. `libmagic` (used by the sandbox ingestion service for magic-byte validation) reports their MIME type as `application/x-hdf5`, not `application/x-netcdf`. The sandbox detector's MIME whitelist for `netcdf-to-cog` must include `application/x-hdf5` alongside `application/x-netcdf` and `application/x-hdf`. Without it, every real-world NetCDF4 file (NCEP reanalysis, ERA5, etc.) is rejected at the scan step with "does not match expected format". Fix: add `application/x-hdf5` to `_MIME_WHITELIST[FormatPair.NETCDF_TO_COG]` in `sandbox/ingestion/src/services/detector.py`.

## Changelog

- 2026-03-14: Document NetCDF4/HDF5 MIME type rejection failure mode.
- 2026-03-13: Initial implementation — xarray + rio-cogeo pipeline with 8-check validator and self-test.
