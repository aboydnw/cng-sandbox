import os
import numpy as np
import pytest
import h5py
import rasterio


@pytest.fixture
def nisar_like_h5(tmp_path):
    """Create a minimal NISAR-like HDF5 file with projected coordinates.

    Uses 600x800 pixels to be large enough for overview generation (needs > 512x512).
    """
    path = tmp_path / "test.h5"
    with h5py.File(path, "w") as f:
        grp = f.create_group("science/LSAR/SME2/grids")
        y_coords = np.linspace(-1000000.0, -1200000.0, 600)
        x_coords = np.linspace(-7200000.0, -7000000.0, 800)
        data = np.random.default_rng(42).random((600, 800)).astype(np.float32)
        data[0, 0] = -9999.0

        grp.create_dataset("soilMoisture", data=data)
        grp["soilMoisture"].attrs["_FillValue"] = np.float32(-9999.0)
        grp.create_dataset("xCoordinates", data=x_coords)
        grp.create_dataset("yCoordinates", data=y_coords)
        grp.create_dataset("xCoordinateSpacing", data=abs(x_coords[1] - x_coords[0]))
        grp.create_dataset("yCoordinateSpacing", data=abs(y_coords[1] - y_coords[0]))
        grp.create_dataset("projection", data=np.uint32(6933))
    return str(path)


def test_convert_produces_valid_cog(nisar_like_h5, tmp_path):
    from convert import convert
    output = str(tmp_path / "output.tif")
    convert(nisar_like_h5, output, variable="soilMoisture",
            group="science/LSAR/SME2/grids", verbose=True)

    assert os.path.exists(output)
    with rasterio.open(output) as src:
        assert str(src.crs) == "EPSG:4326"
        assert src.count == 1
        assert src.nodata is not None
        b = src.bounds
        assert -180 <= b.left <= 180
        assert -90 <= b.bottom <= 90


def test_validation_passes(nisar_like_h5, tmp_path):
    from convert import convert
    from validate import run_checks
    output = str(tmp_path / "output.tif")
    convert(nisar_like_h5, output, variable="soilMoisture",
            group="science/LSAR/SME2/grids", verbose=True)

    results = run_checks(nisar_like_h5, output, variable="soilMoisture",
                         group="science/LSAR/SME2/grids")
    failed = [r for r in results if not r.passed]
    assert not failed, f"Validation failures: {[(r.name, r.detail) for r in failed]}"


@pytest.fixture
def nisar_coords_in_parent(tmp_path):
    """HDF5 where coordinates and projection are in a parent group, not alongside the data."""
    path = tmp_path / "parent_coords.h5"
    with h5py.File(path, "w") as f:
        grid = f.create_group("science/LSAR/GCOV/grids")
        y_coords = np.linspace(-1000000.0, -1200000.0, 600)
        x_coords = np.linspace(-7200000.0, -7000000.0, 800)
        grid.create_dataset("xCoordinates", data=x_coords)
        grid.create_dataset("yCoordinates", data=y_coords)
        grid.create_dataset("projection", data=np.uint32(6933))

        freq = grid.create_group("frequencyA")
        data = np.random.default_rng(42).random((600, 800)).astype(np.float32)
        freq.create_dataset("HHHH", data=data)
    return str(path)


def test_convert_finds_coords_in_parent_group(nisar_coords_in_parent, tmp_path):
    from convert import convert
    output = str(tmp_path / "output.tif")
    convert(nisar_coords_in_parent, output, variable="HHHH",
            group="science/LSAR/GCOV/grids/frequencyA", verbose=True)

    assert os.path.exists(output)
    with rasterio.open(output) as src:
        assert str(src.crs) == "EPSG:4326"
        assert src.count == 1


@pytest.fixture
def complex_h5(tmp_path):
    """HDF5 with a complex-valued dataset (e.g. SAR SLC data)."""
    path = tmp_path / "complex.h5"
    with h5py.File(path, "w") as f:
        grp = f.create_group("science/LSAR/GSLC/grids/frequencyA")
        rng = np.random.default_rng(42)
        data = (rng.random((600, 800)) + 1j * rng.random((600, 800))).astype(np.complex64)
        grp.create_dataset("HH", data=data)
        grp.create_dataset("xCoordinates", data=np.linspace(-120.0, -119.0, 800))
        grp.create_dataset("yCoordinates", data=np.linspace(35.0, 34.0, 600))
    return str(path)


def test_convert_handles_complex_data(complex_h5, tmp_path):
    from convert import convert
    output = str(tmp_path / "output.tif")
    convert(complex_h5, output, variable="HH",
            group="science/LSAR/GSLC/grids/frequencyA", verbose=True)

    assert os.path.exists(output)
    with rasterio.open(output) as src:
        assert src.count == 1
        band = src.read(1)
        assert np.all(band >= 0), "Magnitude should be non-negative"
