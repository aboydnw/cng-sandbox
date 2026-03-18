# Geo Conversion Validator Shootout

Compares multiple geospatial conversion tools and grades their output using
our `validate.py` scripts to prove the validators catch real silent failures.

## Quick start

```bash
# Install dependencies
pip install rasterio rio-cogeo geopandas pyarrow numpy duckdb

# Optional: install gpq from https://github.com/planetlabs/gpq/releases
# Optional: apt install gdal-bin (for gdal_translate and ogr2ogr)

# Run everything
cd docs/shootout
python run_shootout.py
```

## What it does

1. Downloads test data (cached in `data/`, gitignored)
2. Converts each test file with each tool
3. Validates each conversion with our `validate.py` scripts
4. Renders pass/fail matrices to `results/`

## After running

Review `results/raster_matrix.md` and `results/vector_matrix.md` for failures.
Write up findings in `results/findings.md`, classifying each failure as:

- **Real defect** — tool silently broke something
- **False positive** — our validator is wrong (fix it)
- **Expected limitation** — known lossy behavior

See the design spec: `docs/superpowers/specs/2026-03-13-geo-conversion-validator-shootout-design.md`
