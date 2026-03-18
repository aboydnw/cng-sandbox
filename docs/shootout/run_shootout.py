"""Geo Conversion Validator Shootout — run all conversions and validations."""

import dataclasses
import importlib.util
import json
import sys
from pathlib import Path

# Ensure imports work regardless of cwd
sys.path.insert(0, str(Path(__file__).resolve().parent))

from converters import (
    raster_rio_cogeo,
    raster_gdal,
    raster_rasterio_raw,
    raster_cogger,
    vector_geopandas,
    vector_gpq,
    vector_ogr2ogr,
    vector_duckdb,
)
import acquire_data

# --- Paths ---

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SHOOTOUT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SHOOTOUT_DIR / "results"
RAW_DIR = RESULTS_DIR / "raw"
OUTPUTS_DIR = RAW_DIR / "outputs"

RASTER_VALIDATOR = REPO_ROOT / "skills/geo-conversions/geotiff-to-cog/scripts/validate.py"
SHAPEFILE_VALIDATOR = REPO_ROOT / "skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py"
GEOJSON_VALIDATOR = REPO_ROOT / "skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py"

# --- Local test data (already in repo) ---

FIRMS_SHP = REPO_ROOT / "docs/geo-conversion-test-results/test-2-real-data/firms_shp/SUOMI_VIIRS_C2_Global_24h.shp"
HYDRORIVERS_SHP = REPO_ROOT / "HydroRIVERS_v10_gr_shp/HydroRIVERS_v10_gr_shp/HydroRIVERS_v10_gr.shp"
EARTHQUAKES_GEOJSON = REPO_ROOT / "docs/geo-conversion-test-results/test-2-real-data/earthquakes.geojson"


def load_validator(validator_path: Path):
    """Dynamically import a validate.py module."""
    spec = importlib.util.spec_from_file_location("validator", validator_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_test_registry(downloaded: dict[str, Path | None]) -> tuple[list, list]:
    """Build the raster and vector test registries from available data."""
    raster_converters = [raster_rio_cogeo, raster_gdal, raster_rasterio_raw, raster_cogger]
    shapefile_converters = [vector_geopandas, vector_ogr2ogr, vector_duckdb]
    geojson_converters = [vector_geopandas, vector_gpq, vector_ogr2ogr, vector_duckdb]

    raster_tests = []
    if downloaded.get("ne_color"):
        raster_tests.append({"name": "ne_color", "path": downloaded["ne_color"],
                             "converters": raster_converters})
    if downloaded.get("neo_sst"):
        raster_tests.append({"name": "neo_sst", "path": downloaded["neo_sst"],
                             "converters": raster_converters})
    if downloaded.get("ne_gray"):
        raster_tests.append({"name": "ne_gray", "path": downloaded["ne_gray"],
                             "converters": raster_converters})

    vector_tests = []
    if FIRMS_SHP.exists():
        vector_tests.append({"name": "firms", "format": "shapefile",
                             "path": FIRMS_SHP, "converters": shapefile_converters})
    if HYDRORIVERS_SHP.exists():
        vector_tests.append({"name": "hydrorivers", "format": "shapefile",
                             "path": HYDRORIVERS_SHP, "converters": shapefile_converters})
    if downloaded.get("ne_countries_shp"):
        vector_tests.append({"name": "ne_countries_shp", "format": "shapefile",
                             "path": downloaded["ne_countries_shp"],
                             "converters": shapefile_converters})
    if EARTHQUAKES_GEOJSON.exists():
        vector_tests.append({"name": "earthquakes", "format": "geojson",
                             "path": EARTHQUAKES_GEOJSON, "converters": geojson_converters})
    if downloaded.get("ne_countries_geojson"):
        vector_tests.append({"name": "ne_countries_geojson", "format": "geojson",
                             "path": downloaded["ne_countries_geojson"],
                             "converters": geojson_converters})
    if downloaded.get("ne_rivers_geojson"):
        vector_tests.append({"name": "ne_rivers_geojson", "format": "geojson",
                             "path": downloaded["ne_rivers_geojson"],
                             "converters": geojson_converters})

    return raster_tests, vector_tests


def run_single(test_name: str, input_path: Path, converter_mod,
               validator_mod, output_suffix: str) -> dict:
    """Run one conversion + validation and return JSON-serializable result."""
    tool_name = converter_mod.TOOL_NAME
    output_path = OUTPUTS_DIR / f"{tool_name}_{test_name}{output_suffix}"

    print(f"\n  [{tool_name}] Converting {test_name}...")
    conv_result = converter_mod.convert(input_path, output_path)
    print(f"  [{tool_name}] {conv_result.status} ({conv_result.duration_seconds:.1f}s)")

    checks = []
    if conv_result.status == "success":
        print(f"  [{tool_name}] Validating...")
        try:
            check_results = validator_mod.run_checks(str(input_path), str(output_path))
            checks = [dataclasses.asdict(c) for c in check_results]
            passed = sum(1 for c in check_results if c.passed)
            failed = sum(1 for c in check_results if not c.passed)
            print(f"  [{tool_name}] {passed} passed, {failed} failed")
        except Exception as e:
            print(f"  [{tool_name}] Validation error: {e}")
            checks = [{"name": "validation_error", "passed": False, "detail": str(e)}]

    conv_dict = dataclasses.asdict(conv_result)
    conv_dict.pop("tool", None)

    return {
        "converter": tool_name,
        "test_file": test_name,
        "input_path": str(input_path),
        "output_path": str(output_path),
        "conversion": conv_dict,
        "checks": checks,
    }


def render_matrix(results: list[dict], check_names: list[str], output_path: Path):
    """Render a markdown pass/fail matrix from results."""
    by_file = {}
    for r in results:
        by_file.setdefault(r["test_file"], []).append(r)

    lines = []
    header = "| Source File | Tool | Status | " + " | ".join(check_names) + " |"
    sep = "|---|---|---|" + "|".join(["---"] * len(check_names)) + "|"
    lines.append(header)
    lines.append(sep)

    for test_name, runs in by_file.items():
        for r in runs:
            status = r["conversion"]["status"]
            if status != "success":
                cells = [status.upper()] * len(check_names)
            else:
                check_map = {c["name"]: c["passed"] for c in r["checks"]}
                cells = []
                for cn in check_names:
                    if cn in check_map:
                        cells.append("PASS" if check_map[cn] else "**FAIL**")
                    else:
                        cells.append("—")
            row = f"| {test_name} | {r['converter']} | {status} | " + " | ".join(cells) + " |"
            lines.append(row)

    output_path.write_text("\n".join(lines) + "\n")
    print(f"\nMatrix written to {output_path}")


RASTER_CHECK_NAMES = [
    "COG structure", "CRS preserved", "Bounds preserved", "Dimensions",
    "Band count", "Pixel fidelity", "NoData preserved", "Overviews",
]

VECTOR_CHECK_NAMES = [
    "Row count", "CRS preserved", "Columns preserved", "Geometry type",
    "Geometry validity", "Geometry fidelity", "Attribute fidelity",
    "Bounds preserved", "GeoParquet metadata",
]


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("PHASE 1: Acquiring test data")
    print("=" * 60)
    downloaded = acquire_data.acquire_all()

    print("\n" + "=" * 60)
    print("PHASE 2: Running conversions and validations")
    print("=" * 60)

    raster_tests, vector_tests = build_test_registry(downloaded)

    raster_validator = load_validator(RASTER_VALIDATOR)
    shapefile_validator = load_validator(SHAPEFILE_VALIDATOR)
    geojson_validator = load_validator(GEOJSON_VALIDATOR)

    raster_results = []
    for test in raster_tests:
        for conv in test["converters"]:
            result = run_single(test["name"], test["path"], conv,
                                raster_validator, ".tif")
            raster_results.append(result)
            json_path = RAW_DIR / f"{conv.TOOL_NAME}_{test['name']}.json"
            json_path.write_text(json.dumps(result, indent=2))

    vector_results = []
    for test in vector_tests:
        validator = shapefile_validator if test["format"] == "shapefile" else geojson_validator
        for conv in test["converters"]:
            result = run_single(test["name"], test["path"], conv,
                                validator, ".parquet")
            vector_results.append(result)
            json_path = RAW_DIR / f"{conv.TOOL_NAME}_{test['name']}.json"
            json_path.write_text(json.dumps(result, indent=2))

    print("\n" + "=" * 60)
    print("PHASE 3: Rendering reports")
    print("=" * 60)

    if raster_results:
        render_matrix(raster_results, RASTER_CHECK_NAMES, RESULTS_DIR / "raster_matrix.md")
    if vector_results:
        render_matrix(vector_results, VECTOR_CHECK_NAMES, RESULTS_DIR / "vector_matrix.md")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_results = raster_results + vector_results
    total = len(all_results)
    skipped = sum(1 for r in all_results if r["conversion"]["status"] == "skipped")
    errored = sum(1 for r in all_results if r["conversion"]["status"] == "error")
    succeeded = sum(1 for r in all_results if r["conversion"]["status"] == "success")

    total_checks = sum(len(r["checks"]) for r in all_results)
    failed_checks = sum(1 for r in all_results for c in r["checks"] if not c["passed"])

    print(f"Runs: {total} total, {succeeded} success, {errored} error, {skipped} skipped")
    print(f"Checks: {total_checks} total, {failed_checks} failed")
    print(f"\nRaw results: {RAW_DIR}/")
    print(f"Matrices: {RESULTS_DIR}/raster_matrix.md, {RESULTS_DIR}/vector_matrix.md")
    print(f"\nNext step: Review failures in the matrices and write findings.md")


if __name__ == "__main__":
    main()
