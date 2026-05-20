import json
import subprocess

import geopandas as gpd
import obstore
import pytest
from obstore.store import MemoryStore
from shapely.geometry import Polygon

from src.services.pmtiles_ingest import (
    get_pmtiles_tile_url,
    ingest_pmtiles,
    parquet_to_pmtiles_file,
)
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


def test_parquet_to_pmtiles_reprojects_non_wgs84_input(monkeypatch, tmp_path):
    """Non-WGS84 input (e.g. UTM) is reprojected to EPSG:4326 before tippecanoe.

    Tippecanoe's GeoJSON input must be in CRS84/WGS84. Shapefiles in projected
    CRSes (like NAD83 UTM Zone 10N / EPSG:26910) were previously passed through
    with their native coordinates, producing garbage tiles and tippecanoe warnings.
    """
    utm_polygon = Polygon(
        [
            (594129.88, 4964353.97),
            (743218.27, 4964353.97),
            (743218.27, 5216483.43),
            (594129.88, 5216483.43),
        ]
    )
    gdf = gpd.GeoDataFrame(
        {"name": ["aoi"], "name_two": ["aoi2"]},
        geometry=[utm_polygon],
        crs="EPSG:26910",
    )
    parquet_path = str(tmp_path / "utm.parquet")
    gdf.to_parquet(parquet_path)

    captured_geojson: dict = {}

    def fake_run(cmd, **kwargs):
        geojson_path = next(arg for arg in cmd if arg.endswith(".geojson"))
        with open(geojson_path) as f:
            captured_geojson["data"] = json.load(f)
        output_flag = next(f for f in cmd if f.startswith("--output="))
        _write_fake_pmtiles(output_flag.split("=", 1)[1])
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    pmtiles_path = str(tmp_path / "out.pmtiles")
    parquet_to_pmtiles_file(parquet_path, pmtiles_path)

    crs_name = captured_geojson["data"].get("crs", {}).get("properties", {}).get("name")
    assert crs_name in (None, "urn:ogc:def:crs:OGC:1.3:CRS84", "EPSG:4326")
    coords = captured_geojson["data"]["features"][0]["geometry"]["coordinates"][0]
    for lon, lat in coords:
        assert -180 <= lon <= 180
        assert -90 <= lat <= 90


def test_parquet_to_pmtiles_coincident_features_use_explicit_maxzoom(
    monkeypatch, tmp_path
):
    """Multiple features at the same location still trigger explicit --maximum-zoom.

    Tippecanoe's `-zg` failure mode is "at least two distinct feature locations",
    not a raw feature count — two coincident polygons would otherwise crash.
    """
    same_polygon = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    gdf = gpd.GeoDataFrame(
        {"name": ["a", "b"]},
        geometry=[same_polygon, same_polygon],
        crs="EPSG:4326",
    )
    parquet_path = str(tmp_path / "coincident.parquet")
    gdf.to_parquet(parquet_path)

    captured_cmd: list = []

    def fake_run(cmd, **kwargs):
        captured_cmd.extend(cmd)
        output_flag = next(f for f in cmd if f.startswith("--output="))
        _write_fake_pmtiles(output_flag.split("=", 1)[1])
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    parquet_to_pmtiles_file(parquet_path, str(tmp_path / "out.pmtiles"))

    assert "--maximum-zoom=g" not in captured_cmd
    assert any(
        arg.startswith("--maximum-zoom=") and arg != "--maximum-zoom=g"
        for arg in captured_cmd
    )


def test_parquet_to_pmtiles_single_feature_uses_explicit_maxzoom(monkeypatch, tmp_path):
    """Single feature triggers explicit --maximum-zoom (not =g).

    Tippecanoe's `--maximum-zoom=g` fails with "Can't guess maxzoom (-zg)
    without at least two distinct feature locations" when only one feature
    exists. A reasonable explicit max zoom is used as a fallback.
    """
    gdf = gpd.GeoDataFrame(
        {"name": ["only"]},
        geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        crs="EPSG:4326",
    )
    parquet_path = str(tmp_path / "single.parquet")
    gdf.to_parquet(parquet_path)

    captured_cmd: list = []

    def fake_run(cmd, **kwargs):
        captured_cmd.extend(cmd)
        output_flag = next(f for f in cmd if f.startswith("--output="))
        _write_fake_pmtiles(output_flag.split("=", 1)[1])
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    parquet_to_pmtiles_file(parquet_path, str(tmp_path / "out.pmtiles"))

    assert "--maximum-zoom=g" not in captured_cmd
    assert any(
        arg.startswith("--maximum-zoom=") and arg != "--maximum-zoom=g"
        for arg in captured_cmd
    )


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
