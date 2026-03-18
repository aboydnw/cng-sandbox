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
