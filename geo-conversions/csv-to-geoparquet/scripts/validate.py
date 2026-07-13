"""Validate a GeoParquet produced from a CSV/TSV via geometry-column mapping.

Unlike the other vector skills, the source CSV has no geometry that geopandas
can read directly, so the checks operate on the converted GeoParquet output.
They encode the invariants the ingestion converter enforces (numeric, in-range
coordinates; EPSG:4326 storage; lowercase columns) so future conversions catch
regressions.
"""

import argparse
import dataclasses
import json
import os
import sys

import geopandas as gpd
import pyarrow.parquet as pq


@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def check_row_count(dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that the output has at least one feature."""
    if len(dst) > 0:
        return CheckResult("Row count", True, f"{len(dst)} rows")
    return CheckResult("Row count", False, "Output has no rows")


def check_geoparquet_metadata(output_path: str) -> CheckResult:
    """Check that the parquet file has valid GeoParquet 'geo' metadata."""
    pf = pq.read_metadata(output_path)
    metadata = pf.schema.to_arrow_schema().metadata
    if metadata and b"geo" in metadata:
        geo_meta = json.loads(metadata[b"geo"])
        if "primary_column" in geo_meta and "columns" in geo_meta:
            return CheckResult("GeoParquet metadata", True, "Valid geo metadata")
        return CheckResult(
            "GeoParquet metadata", False, "geo key present but missing required fields"
        )
    return CheckResult("GeoParquet metadata", False, "No 'geo' key in parquet metadata")


def check_crs_4326(dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that the output is stored in EPSG:4326."""
    from pyproj import CRS

    if dst.crs is None:
        return CheckResult("CRS is EPSG:4326", False, "Output has no CRS")
    crs = CRS.from_user_input(dst.crs)
    if crs == CRS.from_epsg(4326):
        return CheckResult("CRS is EPSG:4326", True, "EPSG:4326")
    epsg = crs.to_epsg()
    label = f"EPSG:{epsg}" if epsg else crs.name
    return CheckResult("CRS is EPSG:4326", False, f"Output CRS is {label}, not 4326")


def check_geometry_validity(dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that every geometry is present, non-empty, and valid."""
    null_count = int(dst.geometry.isna().sum())
    empty_count = int(dst.geometry.is_empty.sum())
    invalid_count = int((~dst.geometry.is_valid).sum())
    if null_count == 0 and empty_count == 0 and invalid_count == 0:
        return CheckResult("Geometry validity", True, "All geometries valid")
    return CheckResult(
        "Geometry validity",
        False,
        f"{null_count} null, {empty_count} empty, {invalid_count} invalid",
    )


def check_coordinate_range(dst: gpd.GeoDataFrame) -> CheckResult:
    """Check that all coordinates fall within valid lon/lat bounds."""
    minx, miny, maxx, maxy = dst.total_bounds
    if -180 <= minx <= maxx <= 180 and -90 <= miny <= maxy <= 90:
        return CheckResult(
            "Coordinate range",
            True,
            f"bounds [{minx:.3f}, {miny:.3f}, {maxx:.3f}, {maxy:.3f}]",
        )
    return CheckResult(
        "Coordinate range",
        False,
        f"bounds [{minx}, {miny}, {maxx}, {maxy}] fall outside lon/lat limits",
    )


def check_column_names_lowercase(dst: gpd.GeoDataFrame) -> CheckResult:
    """Warn if column names contain uppercase letters (breaks tipg/PostgreSQL)."""
    non_geom_cols = [c for c in dst.columns if c != dst.geometry.name]
    upper_cols = [c for c in non_geom_cols if c != c.lower()]
    if not upper_cols:
        return CheckResult("Column names lowercase", True, "All columns lowercase")
    return CheckResult(
        "Column names lowercase",
        False,
        f"Uppercase columns will break tipg/PostgreSQL: {upper_cols}",
    )


def run_checks(input_path: str, output_path: str, **kwargs) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    dst = gpd.read_parquet(output_path)
    return [
        check_row_count(dst),
        check_geoparquet_metadata(output_path),
        check_crs_4326(dst),
        check_geometry_validity(dst),
        check_coordinate_range(dst),
        check_column_names_lowercase(dst),
    ]


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


def run_validation(input_path, output_path):
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path)
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(
        description="Validate GeoParquet produced from a CSV/TSV"
    )
    parser.add_argument("--input", help="Path to original CSV/TSV")
    parser.add_argument("--output", required=True, help="Path to converted GeoParquet")
    args = parser.parse_args()

    if not os.path.isfile(args.output):
        print(f"Error: output file not found: {args.output}")
        sys.exit(1)
    passed = run_validation(args.input, args.output)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
