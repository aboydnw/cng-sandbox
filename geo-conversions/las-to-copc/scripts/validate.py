"""Validate that a COPC file preserves all data from the source LAS/LAZ."""

import argparse
import dataclasses
import os
import subprocess
import sys

import laspy


@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def _header(path: str):
    with laspy.open(path) as reader:
        return reader.header


def check_copc_vlr_present(output_path: str) -> CheckResult:
    """Check that the COPC info VLR (user_id='copc', record_id=1) is present."""
    header = _header(output_path)
    for vlr in header.vlrs:
        if vlr.user_id == "copc" and vlr.record_id == 1:
            return CheckResult("COPC VLR", True, "copc info VLR (record_id 1) present")
    return CheckResult(
        "COPC VLR",
        False,
        "No COPC info VLR found — output is not a valid COPC file",
    )


_PDAL_INFO_TIMEOUT_SECONDS = 120


def check_copc_hierarchy_readable(output_path: str) -> CheckResult:
    """Check that PDAL can read the COPC octree hierarchy without error."""
    try:
        result = subprocess.run(
            ["pdal", "info", "--summary", output_path],
            capture_output=True,
            text=True,
            timeout=_PDAL_INFO_TIMEOUT_SECONDS,
        )
    except FileNotFoundError:
        return CheckResult("COPC hierarchy", False, "pdal CLI not available")
    except subprocess.TimeoutExpired:
        return CheckResult(
            "COPC hierarchy",
            False,
            f"pdal info timed out after {_PDAL_INFO_TIMEOUT_SECONDS}s",
        )
    if result.returncode == 0:
        return CheckResult("COPC hierarchy", True, "pdal read the hierarchy summary")
    return CheckResult(
        "COPC hierarchy", False, f"pdal info failed: {result.stderr.strip()}"
    )


def check_point_count_preserved(input_path: str, output_path: str) -> CheckResult:
    """Check that the point count is preserved."""
    src = _header(input_path).point_count
    dst = _header(output_path).point_count
    if src == dst:
        return CheckResult("Point count", True, f"{src}")
    return CheckResult("Point count", False, f"Source: {src}, Output: {dst}")


def check_crs_preserved(input_path: str, output_path: str) -> CheckResult:
    """Check that the CRS is preserved.

    Compares EPSG codes when both sides expose one. For WKT-only or compound
    CRSes that have no EPSG code, ``to_epsg()`` returns None on both sides, so
    comparing EPSG alone would pass vacuously (None == None) even when the
    conversion dropped or altered the projection — exactly the compound-CRS
    class this conversion targets. In that case fall back to comparing the CRS
    objects directly. A missing output CRS is always a failure: the ingestion
    guard rejects a source with no CRS before conversion, so the input is known
    to have had one.
    """
    src = _header(input_path).parse_crs()
    dst = _header(output_path).parse_crs()

    if src is None:
        return CheckResult("CRS preserved", False, "Source has no CRS")
    if dst is None:
        return CheckResult(
            "CRS preserved", False, "Output dropped the CRS (source had one)"
        )

    src_epsg = src.to_epsg()
    dst_epsg = dst.to_epsg()
    if src_epsg is not None and dst_epsg is not None:
        if src_epsg == dst_epsg:
            return CheckResult("CRS preserved", True, f"EPSG:{src_epsg}")
        return CheckResult(
            "CRS preserved",
            False,
            f"Source: EPSG:{src_epsg}, Output: EPSG:{dst_epsg}",
        )

    if src.equals(dst):
        return CheckResult("CRS preserved", True, f"WKT match ({src.name})")
    return CheckResult(
        "CRS preserved",
        False,
        f"CRS mismatch (no EPSG): source={src.name}, output={dst.name}",
    )


def check_bounds_match(
    input_path: str, output_path: str, tolerance: float = 1e-3
) -> CheckResult:
    """Check that the header min/max x/y/z bounds are preserved within tolerance."""
    src = _header(input_path)
    dst = _header(output_path)
    for attr in ("x_min", "y_min", "z_min", "x_max", "y_max", "z_max"):
        src_val = getattr(src, attr)
        dst_val = getattr(dst, attr)
        if abs(src_val - dst_val) > tolerance:
            return CheckResult(
                "Bounds preserved",
                False,
                f"{attr}: source={src_val}, output={dst_val}",
            )
    return CheckResult(
        "Bounds preserved",
        True,
        f"({src.x_min:.3f}, {src.y_min:.3f}, {src.x_max:.3f}, {src.y_max:.3f})",
    )


def run_checks(input_path: str, output_path: str, **kwargs) -> list[CheckResult]:
    """Run core data-integrity checks and return structured results.

    A failed check here means the COPC conversion produced incorrect output.
    """
    return [
        check_copc_vlr_present(output_path),
        check_copc_hierarchy_readable(output_path),
        check_point_count_preserved(input_path, output_path),
        check_crs_preserved(input_path, output_path),
        check_bounds_match(input_path, output_path),
    ]


def print_report(results: list[CheckResult]) -> bool:
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
    print("RESULT: ALL CHECKS PASSED" if all_passed else "RESULT: CHECK(S) FAILED")
    print("=" * 50 + "\n")
    return all_passed


def main():
    parser = argparse.ArgumentParser(
        description="Validate a COPC file against its source LAS/LAZ"
    )
    parser.add_argument("--input", required=True, help="Path to original LAS/LAZ")
    parser.add_argument("--output", required=True, help="Path to converted COPC")
    args = parser.parse_args()

    for path in (args.input, args.output):
        if not os.path.isfile(path):
            print(f"Error: file not found: {path}")
            sys.exit(1)

    passed = print_report(run_checks(args.input, args.output))
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
