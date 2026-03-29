import subprocess

import geopandas as gpd
import obstore
import pytest
from obstore.store import MemoryStore
from shapely.geometry import Polygon

from src.services.pmtiles_ingest import get_pmtiles_tile_url, ingest_pmtiles
from src.services.storage import StorageService


def _write_fake_pmtiles(path: str, min_zoom: int = 0, max_zoom: int = 14) -> None:
    """Write a minimal valid PMTiles v3 header to a file."""
    header = bytearray(102)
    header[:7] = b"PMTiles"
    header[7] = 3
    header[100] = min_zoom
    header[101] = max_zoom
    with open(path, "wb") as f:
        f.write(bytes(header))


def test_get_pmtiles_tile_url():
    url = get_pmtiles_tile_url("abc-123")
    assert url == "/pmtiles/datasets/abc-123/converted/data.pmtiles"


@pytest.fixture
def mock_storage():
    store = MemoryStore()
    return StorageService(store=store, bucket="test-bucket")


@pytest.fixture
def polygon_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["poly_0", "poly_1"]},
        geometry=[
            Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
            Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
        ],
        crs="EPSG:4326",
    )
    path = str(tmp_path / "test.parquet")
    gdf.to_parquet(path)
    return path


@pytest.fixture
def empty_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": []},
        geometry=gpd.GeoSeries([], dtype="geometry"),
        crs="EPSG:4326",
    )
    path = str(tmp_path / "empty.parquet")
    gdf.to_parquet(path)
    return path


def test_ingest_pmtiles_calls_tippecanoe_with_required_flags(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles runs tippecanoe with all required flags."""
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        _write_fake_pmtiles(output_path)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)

    tile_url, min_zoom, max_zoom, file_size = ingest_pmtiles(
        "abc-123", polygon_parquet, _storage=mock_storage
    )

    assert len(calls) == 1
    cmd = calls[0]
    assert cmd[0] == "tippecanoe"
    assert "--no-feature-limit" in cmd
    assert "--no-tile-size-limit" in cmd
    assert "--force" in cmd
    assert "--maximum-zoom=g" in cmd
    assert "--layer=default" in cmd
    assert tile_url == "/pmtiles/datasets/abc-123/converted/data.pmtiles"
    assert min_zoom == 0
    assert max_zoom == 14
    assert file_size == 102


def test_ingest_pmtiles_uploads_to_storage(monkeypatch, polygon_parquet, mock_storage):
    """ingest_pmtiles uploads the generated .pmtiles file to storage."""

    def fake_run(cmd, **kwargs):
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        _write_fake_pmtiles(output_path)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)

    # Verify the file was uploaded to storage
    result = obstore.get(mock_storage.store, "datasets/abc-123/converted/data.pmtiles")
    assert len(bytes(result.bytes())) == 102  # valid PMTiles header size


def test_ingest_pmtiles_raises_on_tippecanoe_failure(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles raises RuntimeError when tippecanoe exits non-zero."""

    def fake_run(cmd, **kwargs):
        return subprocess.CompletedProcess(cmd, 1, "", "tippecanoe: fatal error")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(RuntimeError):
        ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)


def test_ingest_pmtiles_raises_on_empty_dataset(empty_parquet, mock_storage):
    """ingest_pmtiles raises ValueError when dataset has no features."""
    with pytest.raises(ValueError):
        ingest_pmtiles("abc-123", empty_parquet, _storage=mock_storage)


def test_ingest_pmtiles_returns_zoom_range_and_size(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles returns (tile_url, min_zoom, max_zoom, file_size)."""

    def fake_run(cmd, **kwargs):
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        _write_fake_pmtiles(output_path, min_zoom=3, max_zoom=12)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    _, min_zoom, max_zoom, file_size = ingest_pmtiles(
        "abc-123", polygon_parquet, _storage=mock_storage
    )
    assert min_zoom == 3
    assert max_zoom == 12
    assert file_size == 102


def test_read_pmtiles_zoom_range(tmp_path):
    """_read_pmtiles_zoom_range reads min/max zoom from a valid PMTiles header."""
    from src.services.pmtiles_ingest import _read_pmtiles_zoom_range

    header = bytearray(102)
    header[:7] = b"PMTiles"
    header[7] = 3
    header[100] = 2
    header[101] = 14
    path = str(tmp_path / "data.pmtiles")
    with open(path, "wb") as f:
        f.write(bytes(header))
    assert _read_pmtiles_zoom_range(path) == (2, 14)


def test_read_pmtiles_zoom_range_invalid_file(tmp_path):
    from src.services.pmtiles_ingest import _read_pmtiles_zoom_range

    path = str(tmp_path / "bad.pmtiles")
    with open(path, "wb") as f:
        f.write(b"NOTVALID")
    with pytest.raises(ValueError):
        _read_pmtiles_zoom_range(path)
