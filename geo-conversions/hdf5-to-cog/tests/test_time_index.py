import numpy as np
import pytest
import h5py
import rasterio


@pytest.fixture
def temporal_hdf5(tmp_path):
    path = tmp_path / "temporal.h5"
    with h5py.File(path, "w") as f:
        data = np.stack([np.full((128, 256), i, dtype=np.float32) for i in range(5)])
        f.create_dataset("temperature", data=data)
        f.create_dataset("x", data=np.linspace(-180, 180, 256))
        f.create_dataset("y", data=np.linspace(-90, 90, 128))
        f["temperature"].attrs["_FillValue"] = -9999.0
    return str(path)


def test_time_index_extracts_correct_slice(temporal_hdf5, tmp_path):
    from convert import convert

    output = str(tmp_path / "out.tif")
    convert(temporal_hdf5, output, variable="temperature", time_index=3, verbose=True)
    with rasterio.open(output) as src:
        data = src.read(1)
        assert data.shape == (128, 256)
        valid = data[data != -9999.0]
        assert np.allclose(valid, 3.0)


def test_time_index_default_zero(temporal_hdf5, tmp_path):
    from convert import convert

    output = str(tmp_path / "out.tif")
    convert(temporal_hdf5, output, variable="temperature", verbose=True)
    with rasterio.open(output) as src:
        data = src.read(1)
        valid = data[data != -9999.0]
        assert np.allclose(valid, 0.0)
