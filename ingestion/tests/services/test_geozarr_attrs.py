import pytest

from src.services.geozarr_attrs import validate_geozarr_attrs


def _good():
    return {
        "spatial:dimensions": ["latitude", "longitude"],
        "spatial:transform": [0.1, 0, -180, 0, -0.1, 90],
        "spatial:shape": [1800, 3600],
        "proj:code": "EPSG:4326",
    }


def test_accepts_well_formed_attrs():
    validate_geozarr_attrs(_good())


def test_rejects_non_dict():
    with pytest.raises(ValueError):
        validate_geozarr_attrs([])  # type: ignore[arg-type]


def test_rejects_missing_required_keys():
    bad = _good()
    del bad["proj:code"]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)


def test_rejects_bad_dimensions():
    bad = _good()
    bad["spatial:dimensions"] = ["lat"]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)
    bad["spatial:dimensions"] = ["lat", 7]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)


def test_rejects_bad_transform():
    bad = _good()
    bad["spatial:transform"] = [0.1, 0, -180, 0, -0.1]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)
    bad["spatial:transform"] = [0.1, 0, -180, 0, -0.1, "x"]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)


def test_rejects_bad_shape():
    bad = _good()
    bad["spatial:shape"] = [1800.5, 3600]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)
    bad["spatial:shape"] = [1800]
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)


def test_rejects_bad_proj_code():
    bad = _good()
    bad["proj:code"] = "WGS84"
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)
    bad["proj:code"] = "EPSG:abc"
    with pytest.raises(ValueError):
        validate_geozarr_attrs(bad)
