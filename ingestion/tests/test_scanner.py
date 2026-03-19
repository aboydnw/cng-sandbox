import numpy as np
import pytest


@pytest.fixture
def sample_hdf5(tmp_path):
    import h5py
    path = tmp_path / "test.h5"
    with h5py.File(path, "w") as f:
        grp = f.create_group("science/data/grids")
        grp.create_dataset("soilMoisture", data=np.zeros((100, 80), dtype=np.float32))
        grp.create_dataset("temperature", data=np.ones((100, 80), dtype=np.float32))
        grp.create_dataset("xCoordinates", data=np.linspace(0, 100, 80))
        grp.create_dataset("yCoordinates", data=np.linspace(0, 100, 100))
        grp.create_dataset("projection", data=np.uint32(6933))
        grp.create_dataset("metadata_string", data="hello")
        grp.create_dataset("scalar_value", data=np.float32(1.0))
    return str(path)


@pytest.fixture
def sample_netcdf(tmp_path):
    import xarray as xr
    path = tmp_path / "test.nc"
    ds = xr.Dataset({
        "temperature": (["lat", "lon"], np.zeros((10, 20), dtype=np.float32)),
        "precipitation": (["lat", "lon"], np.ones((10, 20), dtype=np.float32)),
    }, coords={"lat": np.linspace(-10, 10, 10), "lon": np.linspace(-20, 20, 20)})
    ds.to_netcdf(str(path))
    return str(path)


@pytest.fixture
def single_var_netcdf(tmp_path):
    import xarray as xr
    path = tmp_path / "single.nc"
    ds = xr.Dataset({
        "temperature": (["lat", "lon"], np.zeros((10, 20), dtype=np.float32)),
    }, coords={"lat": np.linspace(-10, 10, 10), "lon": np.linspace(-20, 20, 20)})
    ds.to_netcdf(str(path))
    return str(path)


def test_scan_hdf5_finds_2d_variables(sample_hdf5):
    from src.services.scanner import scan_hdf5
    variables = scan_hdf5(sample_hdf5)
    names = [v["name"] for v in variables]
    assert "soilMoisture" in names
    assert "temperature" in names
    assert "xCoordinates" not in names
    assert "yCoordinates" not in names
    assert "projection" not in names
    assert "metadata_string" not in names
    assert "scalar_value" not in names


def test_scan_hdf5_includes_group_path(sample_hdf5):
    from src.services.scanner import scan_hdf5
    variables = scan_hdf5(sample_hdf5)
    sm = next(v for v in variables if v["name"] == "soilMoisture")
    assert sm["group"] == "science/data/grids"
    assert sm["shape"] == [100, 80]
    assert sm["dtype"] == "float32"


def test_scan_netcdf_finds_data_vars(sample_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(sample_netcdf)
    names = [v["name"] for v in variables]
    assert "temperature" in names
    assert "precipitation" in names
    assert len(variables) == 2


def test_scan_netcdf_group_is_empty(sample_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(sample_netcdf)
    for v in variables:
        assert v["group"] == ""


def test_scan_single_var_netcdf(single_var_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(single_var_netcdf)
    assert len(variables) == 1
    assert variables[0]["name"] == "temperature"
