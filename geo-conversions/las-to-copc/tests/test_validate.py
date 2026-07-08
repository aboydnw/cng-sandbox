import importlib.util
import os
import shutil
import subprocess

import numpy as np
import pytest
from pyproj import CRS

import laspy

_VALIDATE = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "validate.py"
)
_spec = importlib.util.spec_from_file_location("validate", _VALIDATE)
validate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validate)

requires_pdal = pytest.mark.skipif(
    shutil.which("pdal") is None,
    reason="pdal CLI not installed on host",
)


def _write_laz(path, crs):
    rng = np.random.default_rng(7)
    x = rng.uniform(7_600_000, 7_600_500, 300)
    y = rng.uniform(500_000, 500_500, 300)
    z = rng.uniform(100, 300, 300)
    header = laspy.LasHeader(point_format=3, version="1.2")
    header.offsets = [x.min(), y.min(), z.min()]
    header.scales = [0.01, 0.01, 0.01]
    if crs is not None:
        header.add_crs(crs)
    las = laspy.LasData(header)
    las.x, las.y, las.z = x, y, z
    las.classification = rng.integers(1, 6, 300).astype(np.uint8)
    las.write(path)


@pytest.fixture
def las_and_copc(tmp_path):
    src = str(tmp_path / "in.laz")
    dst = str(tmp_path / "out.copc.laz")
    _write_laz(src, CRS.from_epsg(2992))
    subprocess.run(
        ["pdal", "translate", src, dst, "--writers.copc.forward=all"],
        check=True,
        capture_output=True,
    )
    return src, dst


@requires_pdal
def test_copc_vlr_present(las_and_copc):
    _, dst = las_and_copc
    assert validate.check_copc_vlr_present(dst).passed


@requires_pdal
def test_copc_vlr_absent_on_plain_laz(las_and_copc):
    src, _ = las_and_copc
    assert not validate.check_copc_vlr_present(src).passed


@requires_pdal
def test_copc_hierarchy_readable(las_and_copc):
    _, dst = las_and_copc
    assert validate.check_copc_hierarchy_readable(dst).passed


@requires_pdal
def test_point_count_preserved(las_and_copc):
    src, dst = las_and_copc
    assert validate.check_point_count_preserved(src, dst).passed


@requires_pdal
def test_crs_preserved(las_and_copc):
    src, dst = las_and_copc
    assert validate.check_crs_preserved(src, dst).passed


@requires_pdal
def test_bounds_match(las_and_copc):
    src, dst = las_and_copc
    assert validate.check_bounds_match(src, dst).passed


@requires_pdal
def test_run_checks_all_pass(las_and_copc):
    src, dst = las_and_copc
    assert all(c.passed for c in validate.run_checks(src, dst))
