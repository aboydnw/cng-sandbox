"""Validate that GeoParquet preserves all data from a source GeoJSON file."""

import argparse
import dataclasses
import json
import os
import sys
import tempfile

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "numpy": "numpy"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd
import numpy as np
import pyarrow.parquet as pq

@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def _is_null(val) -> bool:
    """Check if a value is None or NaN."""
    if val is None:
        return True
    if isinstance(val, float) and np.isnan(val):
        return True
    return False


def check_row_count(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that source and output have the same number of rows."""
    if len(src) == len(dst):
        return CheckResult("Row count", True, f"{len(src)} rows")
    return CheckResult("Row count", False, f"Source: {len(src)}, Output: {len(dst)}")


def check_crs_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that CRS is preserved using pyproj equality."""
    if src.crs == dst.crs:
        return CheckResult("CRS preserved", True, f"{src.crs}")
    return CheckResult("CRS preserved", False, f"Source: {src.crs}, Output: {dst.crs}")


def check_columns_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that all columns are preserved (case-insensitive, since converter lowercases names)."""
    src_cols = {c.lower() for c in src.columns}
    dst_cols = set(dst.columns)
    if src_cols == dst_cols:
        return CheckResult("Columns preserved", True, f"{len(src_cols)} columns")
    missing = src_cols - dst_cols
    extra = dst_cols - src_cols
    detail = ""
    if missing:
        detail += f"Missing: {missing}. "
    if extra:
        detail += f"Extra: {extra}."
    return CheckResult("Columns preserved", False, detail)


def check_geometry_type(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that geometry types match between source and output."""
    src_types = set(src.geometry.geom_type)
    dst_types = set(dst.geometry.geom_type)
    if src_types == dst_types:
        return CheckResult("Geometry type", True, f"{src_types}")
    return CheckResult("Geometry type", False, f"Source: {src_types}, Output: {dst_types}")


def check_geometry_validity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that the converter did not introduce new invalid geometries."""
    src_invalid = (~src.geometry.is_valid).sum()
    dst_invalid = (~dst.geometry.is_valid).sum()
    new_invalid = dst_invalid - src_invalid
    if new_invalid <= 0:
        if dst_invalid > 0:
            return CheckResult("Geometry validity", True,
                               f"{dst_invalid} invalid (all inherited from source)")
        return CheckResult("Geometry validity", True, "All valid")
    return CheckResult("Geometry validity", False,
                       f"{new_invalid} new invalid geometries introduced (source had {src_invalid})")


def check_geometry_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame, n: int = 100) -> CheckResult:
    """Compare sampled geometries via WKT to verify fidelity."""
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)

    for idx in indices:
        src_wkt = src.geometry.iloc[idx].wkt
        dst_wkt = dst.geometry.iloc[idx].wkt
        if src_wkt != dst_wkt:
            return CheckResult("Geometry fidelity", False,
                               f"Row {idx}: geometries differ")
    return CheckResult("Geometry fidelity", True, f"{sample_size} geometries compared, all match")


def check_attribute_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame, n: int = 100) -> CheckResult:
    """Compare sampled attribute values between source and output.

    Handles the case where converter lowercased column names by mapping src cols to dst cols
    via case-insensitive lookup.
    """
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)
    non_geom_cols = [c for c in src.columns if c != src.geometry.name]
    dst_col_map = {c.lower(): c for c in dst.columns}

    for idx in indices:
        for col in non_geom_cols:
            dst_col = dst_col_map.get(col.lower())
            if dst_col is None:
                continue
            src_val = src[col].iloc[idx]
            dst_val = dst[dst_col].iloc[idx]
            if _is_null(src_val) and _is_null(dst_val):
                continue
            if isinstance(src_val, float) and isinstance(dst_val, float):
                if np.isnan(src_val) and np.isnan(dst_val):
                    continue
            if src_val != dst_val:
                return CheckResult("Attribute fidelity", False,
                                   f"Row {idx}, col '{col}': source={src_val}, output={dst_val}")
    return CheckResult("Attribute fidelity", True,
                       f"{sample_size} rows compared, all match")


def check_bounds_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame, tolerance: float = 1e-8) -> CheckResult:
    """Check that total bounds match within tolerance."""
    src_bounds = src.total_bounds
    dst_bounds = dst.total_bounds
    max_diff = np.max(np.abs(src_bounds - dst_bounds))
    if max_diff <= tolerance:
        return CheckResult("Bounds preserved", True,
                           f"Max diff: {max_diff:.2e}")
    return CheckResult("Bounds preserved", False,
                       f"Max diff: {max_diff:.2e} exceeds {tolerance}")


def check_column_names_lowercase(dst: gpd.GeoDataFrame) -> CheckResult:
    """Warn if column names contain uppercase letters (breaks PostgreSQL tools like tipg)."""
    non_geom_cols = [c for c in dst.columns if c != dst.geometry.name]
    upper_cols = [c for c in non_geom_cols if c != c.lower()]
    if not upper_cols:
        return CheckResult("Column names lowercase", True, "All columns lowercase")
    return CheckResult("Column names lowercase", False,
                       f"Uppercase columns will break tipg/PostgreSQL: {upper_cols}. "
                       f"Lowercase with: gdf.columns = [c.lower() for c in gdf.columns]")


def check_geometry_complexity(dst: gpd.GeoDataFrame, warn_threshold: int = 500_000) -> CheckResult:
    """Warn if total vertex count is high enough to cause PostGIS ST_AsMVT tolerance errors.

    When loaded into PostGIS for vector tile serving via tipg, high-vertex polygon/line
    datasets trigger 'tolerance condition error (-20)' from ST_AsMVT, causing HTTP 500
    for nearly every tile. Pre-simplify before to_postgis() to prevent this.

    Note: The CNG Sandbox pipeline routes polygon/line data through tippecanoe → PMTiles
    instead of PostGIS, so this check does not block the pipeline path. It applies to
    direct PostGIS ingestion only.
    """
    from shapely.geometry.base import BaseGeometry

    def count_coords(geom: BaseGeometry) -> int:
        if geom is None or geom.is_empty:
            return 0
        if hasattr(geom, "geoms"):
            return sum(count_coords(g) for g in geom.geoms)
        if hasattr(geom, "exterior"):
            return len(geom.exterior.coords) + sum(len(r.coords) for r in geom.interiors)
        if hasattr(geom, "coords"):
            return len(list(geom.coords))
        return 0

    non_point = dst.geom_type.isin(["Polygon", "MultiPolygon", "LineString", "MultiLineString"])
    if not non_point.any():
        return CheckResult("Geometry complexity", True, "Point-only dataset; no tile complexity concern")

    total_coords = dst.loc[non_point, "geometry"].apply(count_coords).sum()
    if total_coords <= warn_threshold:
        return CheckResult("Geometry complexity", True,
                           f"Total vertices: {total_coords:,} (below {warn_threshold:,} threshold)")
    return CheckResult("Geometry complexity", False,
                       f"Total vertices: {total_coords:,} exceeds {warn_threshold:,}. "
                       f"Likely to trigger ST_AsMVT 'tolerance condition error (-20)' in tipg "
                       f"and MapLibre 'Max vertices per segment is 65535' errors. "
                       f"Pre-simplify before to_postgis(): "
                       f"gdf.geometry.simplify(0.05, preserve_topology=True)")


def check_geoparquet_metadata(output_path: str) -> CheckResult:
    """Check that the parquet file has valid GeoParquet 'geo' metadata."""
    pf = pq.read_metadata(output_path)
    metadata = pf.schema.to_arrow_schema().metadata
    if metadata and b"geo" in metadata:
        geo_meta = json.loads(metadata[b"geo"])
        if "primary_column" in geo_meta and "columns" in geo_meta:
            return CheckResult("GeoParquet metadata", True, "Valid geo metadata")
        return CheckResult("GeoParquet metadata", False,
                           "geo key present but missing required fields")
    return CheckResult("GeoParquet metadata", False, "No 'geo' key in parquet metadata")


def print_report(results):
    print("\n" + "=" * 50)
    print("VALIDATION REPORT")
    print("=" * 50)

    all_passed = True
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        icon = "+" if r.passed else "!"
        print(f"  [{icon}] {status}: {r.name}")
        print(f"        {r.detail}")
        if not r.passed:
            all_passed = False

    print("=" * 50)
    if all_passed:
        print("RESULT: ALL CHECKS PASSED")
    else:
        failed = sum(1 for r in results if not r.passed)
        print(f"RESULT: {failed} CHECK(S) FAILED")
    print("=" * 50 + "\n")

    return all_passed


def generate_synthetic_geojson(path):
    """Generate a synthetic GeoJSON file with polygons for self-testing."""
    rng = np.random.default_rng(42)
    features = []
    for i in range(50):
        x, y = rng.uniform(-180, 180), rng.uniform(-90, 90)
        size = 0.1
        coords = [
            [x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]
        ]
        features.append({
            "type": "Feature",
            "properties": {
                "id": i,
                "name": f"polygon_{i}",
                "area_km2": float(rng.uniform(1, 1000)),
                "category": f"type_{i % 4}",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords],
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(path, "w") as f:
        json.dump(geojson, f)


def run_self_test():
    """Generate synthetic data, convert, and validate."""
    print("Running self-test...")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    convert_path = os.path.join(script_dir, "convert.py")
    if not os.path.isfile(convert_path):
        print(f"Error: convert.py not found at {convert_path}")
        return False

    import importlib.util
    spec = importlib.util.spec_from_file_location("convert", convert_path)
    convert_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(convert_mod)

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "test_input.geojson")
        output_path = os.path.join(tmpdir, "test_output.parquet")

        print("Generating synthetic GeoJSON...")
        generate_synthetic_geojson(input_path)

        print("Converting to GeoParquet...")
        convert_mod.convert(input_path, output_path, verbose=True)

        print("Validating...")
        return run_validation(input_path, output_path)


def run_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    src = gpd.read_file(input_path)
    dst = gpd.read_parquet(output_path)
    return [
        check_row_count(src, dst),
        check_crs_match(src, dst),
        check_columns_match(src, dst),
        check_geometry_type(src, dst),
        check_geometry_validity(src, dst),
        check_geometry_fidelity(src, dst),
        check_attribute_fidelity(src, dst),
        check_bounds_match(src, dst),
        check_geoparquet_metadata(output_path),
        check_column_names_lowercase(dst),
    ]


def run_validation(input_path, output_path):
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path)
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate GeoParquet against source GeoJSON")
    parser.add_argument("--input", help="Path to original GeoJSON (omit for self-test)")
    parser.add_argument("--output", help="Path to converted GeoParquet (omit for self-test)")
    args = parser.parse_args()

    if args.input is None and args.output is None:
        passed = run_self_test()
    elif args.input and args.output:
        if not os.path.isfile(args.input):
            print(f"Error: input file not found: {args.input}")
            sys.exit(1)
        if not os.path.isfile(args.output):
            print(f"Error: output file not found: {args.output}")
            sys.exit(1)
        passed = run_validation(args.input, args.output)
    else:
        print("Error: provide both --input and --output, or neither for self-test")
        sys.exit(1)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
