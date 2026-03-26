from src.models import DatasetType, FormatPair
from src.services.detector import detect_format


def test_h5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".h5") == FormatPair.HDF5_TO_COG


def test_hdf5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".hdf5") == FormatPair.HDF5_TO_COG


def test_hdf5_dataset_type_is_raster():
    assert FormatPair.HDF5_TO_COG.dataset_type == DatasetType.RASTER


def test_detect_format_h5():
    assert detect_format("data.h5") == FormatPair.HDF5_TO_COG


def test_detect_format_hdf5():
    assert detect_format("data.hdf5") == FormatPair.HDF5_TO_COG
