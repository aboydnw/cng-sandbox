import asyncio

import geopandas as gpd
import pytest

from src.models import DatasetType, FormatPair
from src.services.pipeline import _convert_tabular_to_geoparquet
from src.services.scanner import scan_tabular
from src.state import scan_store, scan_store_lock


@pytest.fixture(autouse=True)
def clear_scan_store():
    scan_store.clear()
    yield
    scan_store.clear()


def test_from_extension_csv_tsv():
    assert FormatPair.from_extension(".csv") == FormatPair.CSV_TO_GEOPARQUET
    assert FormatPair.from_extension(".tsv") == FormatPair.CSV_TO_GEOPARQUET


def test_csv_dataset_type_is_vector():
    assert FormatPair.CSV_TO_GEOPARQUET.dataset_type == DatasetType.VECTOR


def test_detector_accepts_csv_sample(tmp_path):
    from src.services.detector import validate_magic_bytes

    path = tmp_path / "points.csv"
    path.write_text("lat,lon,name\n1.0,2.0,a\n3.0,4.0,b\n")
    validate_magic_bytes(str(path), FormatPair.CSV_TO_GEOPARQUET)


def test_detector_accepts_tsv_sample(tmp_path):
    from src.services.detector import validate_magic_bytes

    path = tmp_path / "points.tsv"
    path.write_text("wkt\tname\nPOINT (2 1)\ta\nPOINT (4 3)\tb\n")
    validate_magic_bytes(str(path), FormatPair.CSV_TO_GEOPARQUET)


def test_scan_tabular_latlon_csv(tmp_path):
    path = tmp_path / "points.csv"
    path.write_text("Latitude,Longitude,name\n1.0,2.0,a\n")
    columns = scan_tabular(str(path))
    by_name = {c["name"]: c for c in columns}
    assert by_name["Latitude"]["role"] == "lat"
    assert by_name["Longitude"]["role"] == "lon"
    assert by_name["name"]["role"] is None


def test_scan_tabular_wkt_tsv(tmp_path):
    path = tmp_path / "shapes.tsv"
    path.write_text("geometry\tname\nPOINT (2 1)\ta\n")
    columns = scan_tabular(str(path))
    by_name = {c["name"]: c for c in columns}
    assert by_name["geometry"]["role"] == "wkt"


def test_scan_tabular_header_only(tmp_path):
    path = tmp_path / "empty.csv"
    path.write_text("x,y,label\n")
    columns = scan_tabular(str(path))
    assert [c["name"] for c in columns] == ["x", "y", "label"]
    assert {c["name"]: c["role"] for c in columns}["x"] == "lon"


def test_convert_latlon_to_points_4326(tmp_path):
    src = tmp_path / "points.csv"
    src.write_text("lat,lon,name\n1.0,2.0,a\n3.0,4.0,b\n")
    out = tmp_path / "out.parquet"
    dropped = _convert_tabular_to_geoparquet(
        str(src),
        str(out),
        lat_column="lat",
        lon_column="lon",
        wkt_column=None,
        geometry_crs="EPSG:4326",
    )
    assert dropped == 0
    gdf = gpd.read_parquet(out)
    assert len(gdf) == 2
    assert gdf.crs.to_epsg() == 4326
    assert list(gdf.geometry.geom_type.unique()) == ["Point"]
    assert (gdf.geometry.x == [2.0, 4.0]).all()


def test_convert_wkt_to_geometry(tmp_path):
    src = tmp_path / "shapes.tsv"
    src.write_text("geometry\tname\nPOINT (2 1)\ta\nLINESTRING (0 0, 1 1)\tb\n")
    out = tmp_path / "out.parquet"
    dropped = _convert_tabular_to_geoparquet(
        str(src),
        str(out),
        lat_column=None,
        lon_column=None,
        wkt_column="geometry",
        geometry_crs="EPSG:4326",
    )
    assert dropped == 0
    gdf = gpd.read_parquet(out)
    assert set(gdf.geometry.geom_type) == {"Point", "LineString"}
    assert "geometry" not in [c for c in gdf.columns if c != gdf.geometry.name]


def test_convert_reprojects_non_4326(tmp_path):
    src = tmp_path / "points.csv"
    # Web Mercator metres near the equator/prime meridian.
    src.write_text("x,y\n222638.98,222684.20\n")
    out = tmp_path / "out.parquet"
    _convert_tabular_to_geoparquet(
        str(src),
        str(out),
        lat_column="y",
        lon_column="x",
        wkt_column=None,
        geometry_crs="EPSG:3857",
    )
    gdf = gpd.read_parquet(out)
    assert gdf.crs.to_epsg() == 4326
    assert gdf.geometry.x.iloc[0] == pytest.approx(2.0, abs=0.01)
    assert gdf.geometry.y.iloc[0] == pytest.approx(2.0, abs=0.01)


def test_convert_non_numeric_coord_raises(tmp_path):
    src = tmp_path / "points.csv"
    src.write_text("lat,lon\n1.0,2.0\nnorth,4.0\n")
    out = tmp_path / "out.parquet"
    with pytest.raises(ValueError):
        _convert_tabular_to_geoparquet(
            str(src),
            str(out),
            lat_column="lat",
            lon_column="lon",
            wkt_column=None,
            geometry_crs="EPSG:4326",
        )


def test_convert_out_of_range_coord_raises(tmp_path):
    src = tmp_path / "points.csv"
    src.write_text("lat,lon\n95.0,2.0\n")
    out = tmp_path / "out.parquet"
    with pytest.raises(ValueError):
        _convert_tabular_to_geoparquet(
            str(src),
            str(out),
            lat_column="lat",
            lon_column="lon",
            wkt_column=None,
            geometry_crs="EPSG:4326",
        )


def test_convert_unparseable_wkt_raises(tmp_path):
    src = tmp_path / "shapes.csv"
    src.write_text("geometry\nnot a geometry\n")
    out = tmp_path / "out.parquet"
    with pytest.raises(ValueError):
        _convert_tabular_to_geoparquet(
            str(src),
            str(out),
            lat_column=None,
            lon_column=None,
            wkt_column="geometry",
            geometry_crs="EPSG:4326",
        )


def test_convert_drops_and_counts_null_geometry(tmp_path):
    src = tmp_path / "points.csv"
    src.write_text("lat,lon,name\n1.0,2.0,a\n,,b\n3.0,4.0,c\n")
    out = tmp_path / "out.parquet"
    dropped = _convert_tabular_to_geoparquet(
        str(src),
        str(out),
        lat_column="lat",
        lon_column="lon",
        wkt_column=None,
        geometry_crs="EPSG:4326",
    )
    assert dropped == 1
    gdf = gpd.read_parquet(out)
    assert len(gdf) == 2


@pytest.mark.asyncio
async def test_scan_convert_sets_column_mapping_and_resumes():
    from src.models import Job, JobStatus

    job = Job(filename="points.csv")
    job.status = JobStatus.SCANNING
    job.scan_event = asyncio.Event()
    scan_id = "csv-scan-1"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/points.csv",
            "job": job,
            "columns": [
                {"name": "lat", "dtype": "float64", "role": "lat"},
                {"name": "lon", "dtype": "float64", "role": "lon"},
                {"name": "name", "dtype": "object", "role": None},
            ],
            "state": "waiting",
        }

    from src.routes.upload import _handle_scan_convert

    await _handle_scan_convert(
        scan_id, lat_column="lat", lon_column="lon", crs="EPSG:4326"
    )

    assert job.lat_column == "lat"
    assert job.lon_column == "lon"
    assert job.geometry_crs == "EPSG:4326"
    assert job.scan_event.is_set()
    assert scan_store[scan_id]["state"] == "converting"


@pytest.mark.asyncio
async def test_scan_convert_rejects_incomplete_mapping():
    from fastapi import HTTPException

    from src.models import Job

    job = Job(filename="points.csv")
    job.scan_event = asyncio.Event()
    scan_id = "csv-scan-2"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/points.csv",
            "job": job,
            "columns": [{"name": "lat", "dtype": "float64", "role": "lat"}],
            "state": "waiting",
        }

    from src.routes.upload import _handle_scan_convert

    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert(scan_id, lat_column="lat")
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_scan_convert_rejects_unknown_column():
    from fastapi import HTTPException

    from src.models import Job

    job = Job(filename="points.csv")
    job.scan_event = asyncio.Event()
    scan_id = "csv-scan-3"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/points.csv",
            "job": job,
            "columns": [
                {"name": "lat", "dtype": "float64", "role": "lat"},
                {"name": "lon", "dtype": "float64", "role": "lon"},
            ],
            "state": "waiting",
        }

    from src.routes.upload import _handle_scan_convert

    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert(scan_id, wkt_column="nope")
    assert exc_info.value.status_code == 400
