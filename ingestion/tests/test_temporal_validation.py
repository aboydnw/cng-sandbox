import numpy as np
import pytest
from src.services import temporal_validation
from src.services.temporal_validation import validate_cross_file_compatibility, compute_global_stats


def _mock_cog_meta(crs="EPSG:4326", width=1000, height=1000, bands=1, bounds=(0, 0, 10, 10)):
    return {"crs": crs, "width": width, "height": height, "bands": bands, "bounds": bounds}


def test_compatible_files_pass(monkeypatch):
    call_count = 0
    def fake_read(path):
        return _mock_cog_meta()
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", fake_read)
    paths = ["/tmp/a.tif", "/tmp/b.tif", "/tmp/c.tif"]
    errors = validate_cross_file_compatibility(paths)
    assert errors == []


def test_mismatched_crs_fails(monkeypatch):
    metas = [_mock_cog_meta(crs="EPSG:4326"), _mock_cog_meta(crs="EPSG:32633")]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "CRS" in errors[0]


def test_mismatched_dimensions_fails(monkeypatch):
    metas = [_mock_cog_meta(width=1000, height=1000), _mock_cog_meta(width=500, height=500)]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "dimensions" in errors[0].lower()


def test_mismatched_band_count_fails(monkeypatch):
    metas = [_mock_cog_meta(bands=1), _mock_cog_meta(bands=3)]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "band" in errors[0].lower()


def test_compute_global_stats(monkeypatch, tmp_path):
    import rasterio
    from rasterio.transform import from_bounds

    for i, (lo, hi) in enumerate([(0.0, 10.0), (5.0, 20.0)]):
        path = tmp_path / f"test_{i}.tif"
        data = np.linspace(lo, hi, 100).reshape(10, 10).astype(np.float32)
        transform = from_bounds(0, 0, 1, 1, 10, 10)
        with rasterio.open(path, "w", driver="GTiff", height=10, width=10, count=1, dtype="float32", transform=transform) as dst:
            dst.write(data, 1)

    rmin, rmax = compute_global_stats([str(tmp_path / "test_0.tif"), str(tmp_path / "test_1.tif")])
    assert rmin == pytest.approx(0.0, abs=0.1)
    assert rmax == pytest.approx(20.0, abs=0.1)
