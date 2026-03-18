import geopandas as gpd
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import Point, Polygon

from src.models import DatasetType, FormatPair
from src.services.pipeline import _detect_use_pmtiles, _extract_band_metadata, _extract_feature_stats, _extract_zoom_range_raster, get_credits


def test_get_credits_raster():
    credits = get_credits(FormatPair.GEOTIFF_TO_COG)
    names = [c["tool"] for c in credits]
    assert "rio-cogeo" in names
    assert "TiTiler" in names
    assert "MapLibre" in names


def test_get_credits_vector():
    credits = get_credits(FormatPair.SHAPEFILE_TO_GEOPARQUET)
    names = [c["tool"] for c in credits]
    assert "GeoPandas" in names
    assert "tipg" in names
    assert "MapLibre" in names


def test_get_credits_netcdf():
    credits = get_credits(FormatPair.NETCDF_TO_COG)
    names = [c["tool"] for c in credits]
    assert "xarray" in names
    assert "rio-cogeo" in names


def test_get_credits_vector_pmtiles():
    credits = get_credits(FormatPair.GEOJSON_TO_GEOPARQUET, use_pmtiles=True)
    names = [c["tool"] for c in credits]
    assert "GeoPandas" in names
    assert "tippecanoe" in names
    assert "PMTiles" in names
    assert "MapLibre" in names
    assert "tipg" not in names


def test_get_credits_vector_tipg_unchanged():
    credits = get_credits(FormatPair.GEOJSON_TO_GEOPARQUET, use_pmtiles=False)
    names = [c["tool"] for c in credits]
    assert "tipg" in names
    assert "tippecanoe" not in names


@pytest.fixture
def polygon_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["a"]},
        geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        crs="EPSG:4326",
    )
    path = str(tmp_path / "polygons.parquet")
    gdf.to_parquet(path)
    return path


@pytest.fixture
def point_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["a"]},
        geometry=[Point(0, 0)],
        crs="EPSG:4326",
    )
    path = str(tmp_path / "points.parquet")
    gdf.to_parquet(path)
    return path


@pytest.fixture
def mixed_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["a", "b"]},
        geometry=[Point(0, 0), Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        crs="EPSG:4326",
    )
    path = str(tmp_path / "mixed.parquet")
    gdf.to_parquet(path)
    return path


def test_extract_feature_stats_single_type(polygon_parquet):
    count, types = _extract_feature_stats(polygon_parquet)
    assert count == 1
    assert types == ["Polygon"]


def test_extract_feature_stats_mixed_types(mixed_parquet):
    count, types = _extract_feature_stats(mixed_parquet)
    assert count == 2
    # Point appears once, Polygon appears once — order is by frequency (ties go either way)
    assert set(types) == {"Point", "Polygon"}


def test_extract_feature_stats_empty(tmp_path):
    import geopandas as gpd
    gdf = gpd.GeoDataFrame({"name": []}, geometry=gpd.GeoSeries([], dtype="geometry"), crs="EPSG:4326")
    path = str(tmp_path / "empty.parquet")
    gdf.to_parquet(path)
    count, types = _extract_feature_stats(path)
    assert count == 0
    assert types == []


def test_extract_zoom_range_raster(tmp_path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds

    transform = from_bounds(0, 0, 1, 1, 256, 256)
    path = str(tmp_path / "test.tif")
    with rasterio.open(
        path, "w", driver="GTiff",
        height=256, width=256, count=1,
        dtype=np.uint8, crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(np.zeros((1, 256, 256), dtype=np.uint8))

    min_zoom, max_zoom = _extract_zoom_range_raster(path)
    assert 0 <= min_zoom <= max_zoom <= 20


def test_detect_use_pmtiles_polygon(polygon_parquet):
    assert _detect_use_pmtiles(polygon_parquet) is True


def test_detect_use_pmtiles_point(point_parquet):
    assert _detect_use_pmtiles(point_parquet) is True


def test_detect_use_pmtiles_mixed(mixed_parquet):
    assert _detect_use_pmtiles(mixed_parquet) is True


@pytest.fixture
def single_band_tif(tmp_path):
    path = str(tmp_path / "single.tif")
    data = np.random.rand(64, 64).astype("float32")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=1, dtype="float32", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
        dst.set_band_description(1, "Precipitation")
    return path


@pytest.fixture
def rgb_tif(tmp_path):
    path = str(tmp_path / "rgb.tif")
    data = np.random.randint(0, 255, (3, 64, 64), dtype="uint8")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=3, dtype="uint8", crs="EPSG:4326", transform=transform,
        photometric="RGB",
    ) as dst:
        dst.write(data)
    return path


@pytest.fixture
def no_description_tif(tmp_path):
    path = str(tmp_path / "nodesc.tif")
    data = np.random.rand(2, 64, 64).astype("float32")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=2, dtype="float32", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data)
    return path


def test_extract_band_metadata_single_band(single_band_tif):
    meta = _extract_band_metadata(single_band_tif)
    assert meta.band_count == 1
    assert meta.band_names == ["Precipitation"]
    assert meta.dtype == "float32"
    assert len(meta.color_interpretation) == 1


def test_extract_band_metadata_rgb(rgb_tif):
    meta = _extract_band_metadata(rgb_tif)
    assert meta.band_count == 3
    assert meta.color_interpretation == ["red", "green", "blue"]
    assert meta.dtype == "uint8"


def test_extract_band_metadata_fallback_names(no_description_tif):
    meta = _extract_band_metadata(no_description_tif)
    assert meta.band_count == 2
    assert meta.band_names == ["Band 1", "Band 2"]


from src.services.pipeline import validate_geojson_structure


def test_invalid_geojson_rejected():
    # Missing "type" field entirely
    bad_bytes = b'{"features": []}'
    with pytest.raises(ValueError, match="Invalid GeoJSON"):
        validate_geojson_structure(bad_bytes)

    # Not a FeatureCollection
    bad_bytes2 = b'{"type": "Point", "coordinates": [0, 0]}'
    with pytest.raises(ValueError, match="Invalid GeoJSON"):
        validate_geojson_structure(bad_bytes2)


def test_valid_geojson_accepted():
    good_bytes = b'{"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {}}]}'
    validate_geojson_structure(good_bytes)  # should not raise


def test_cog_url_built_for_raster():
    converted_key = "datasets/abc-123/converted/data.tif"
    format_pair = FormatPair.GEOTIFF_TO_COG
    cog_url = f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None
    assert cog_url == "/storage/datasets/abc-123/converted/data.tif"


def test_cog_url_none_for_vector():
    converted_key = "datasets/abc-123/converted/data.parquet"
    format_pair = FormatPair.GEOJSON_TO_GEOPARQUET
    cog_url = f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None
    assert cog_url is None
