import pytest
from src.models import FormatPair, DatasetType


def test_h5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".h5") == FormatPair.HDF5_TO_COG


def test_hdf5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".hdf5") == FormatPair.HDF5_TO_COG


def test_hdf5_dataset_type_is_raster():
    assert FormatPair.HDF5_TO_COG.dataset_type == DatasetType.RASTER
