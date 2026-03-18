import pytest
from src.services.temporal_ordering import extract_timestamp_from_filename, order_files


def test_extract_year_only():
    assert extract_timestamp_from_filename("sst_2015.tif") == "2015-01-01T00:00:00Z"


def test_extract_year_month():
    assert extract_timestamp_from_filename("ndvi_2020-07.tif") == "2020-07-01T00:00:00Z"


def test_extract_full_date_dashes():
    assert extract_timestamp_from_filename("fire_2023-11-01.tif") == "2023-11-01T00:00:00Z"


def test_extract_full_date_compact():
    assert extract_timestamp_from_filename("fire_20231101.tif") == "2023-11-01T00:00:00Z"


def test_extract_date_underscores():
    assert extract_timestamp_from_filename("temp_2021_01_15.tif") == "2021-01-15T00:00:00Z"


def test_extract_no_date_returns_none():
    assert extract_timestamp_from_filename("data.tif") is None


def test_order_files_by_filename():
    files = ["sst_2018.tif", "sst_2015.tif", "sst_2020.tif"]
    result = order_files(files)
    assert [r.filename for r in result] == ["sst_2015.tif", "sst_2018.tif", "sst_2020.tif"]
    assert [r.datetime for r in result] == [
        "2015-01-01T00:00:00Z",
        "2018-01-01T00:00:00Z",
        "2020-01-01T00:00:00Z",
    ]
    assert [r.index for r in result] == [0, 1, 2]


def test_order_files_alphabetical_fallback():
    files = ["alpha.tif", "gamma.tif", "beta.tif"]
    result = order_files(files)
    assert [r.filename for r in result] == ["alpha.tif", "beta.tif", "gamma.tif"]
    # No temporal signal — datetimes should still be assigned (monotonic placeholders)
    assert all(r.datetime is not None for r in result)


def test_common_prefix():
    from src.services.temporal_ordering import common_filename_prefix
    assert common_filename_prefix(["sst_2014.tif", "sst_2015.tif", "sst_2016.tif"]) == "sst"
    assert common_filename_prefix(["a.tif", "b.tif"]) == "a"  # fallback to first filename stem
