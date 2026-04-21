import shutil

import geopandas as gpd
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import Point, Polygon

from src.models import DatasetType, FormatPair
from src.services.pipeline import (
    _convert_geotiff_to_cog,
    _detect_use_pmtiles,
    _extract_band_metadata,
    _extract_feature_stats,
    _extract_zoom_range_raster,
    get_credits,
    validate_geojson_structure,
)

requires_gdalwarp = pytest.mark.skipif(
    shutil.which("gdalwarp") is None,
    reason="gdalwarp CLI not installed on host",
)


def test_get_credits_raster():
    credits = get_credits(FormatPair.GEOTIFF_TO_COG)
    names = [c["tool"] for c in credits]
    assert "GDAL" in names
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


def test_get_credits_pmtiles_reference():
    credits = get_credits(FormatPair.PMTILES)
    assert len(credits) == 2
    tools = [c["tool"] for c in credits]
    assert "PMTiles" in tools
    assert "MapLibre" in tools
    assert "tippecanoe" not in tools
    assert "pgSTAC" not in tools
    assert "TiTiler" not in tools
    assert "tipg" not in tools


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

    gdf = gpd.GeoDataFrame(
        {"name": []}, geometry=gpd.GeoSeries([], dtype="geometry"), crs="EPSG:4326"
    )
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
        path,
        "w",
        driver="GTiff",
        height=256,
        width=256,
        count=1,
        dtype=np.uint8,
        crs="EPSG:4326",
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
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
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
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=3,
        dtype="uint8",
        crs="EPSG:4326",
        transform=transform,
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
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=2,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
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
    cog_url = (
        f"/storage/{converted_key}"
        if format_pair.dataset_type == DatasetType.RASTER
        else None
    )
    assert cog_url == "/storage/datasets/abc-123/converted/data.tif"


@pytest.fixture
def categorical_uint32_tif(tmp_path):
    """A uint32 categorical raster with many adjacent category stripes —
    under non-nearest resampling, boundary blending produces bleed codes
    between 1, 7 and 13 (e.g. 3, 4, 5, 10, 11). Size + stripe pitch are
    tuned to force the COG driver to build at least three overview levels.
    """
    width, height = 2048, 2048
    data = np.full((height, width), 255, dtype=np.uint32)
    for i in range(50, width - 50, 20):
        data[50 : height - 50, i : i + 20] = [1, 7, 13][(i // 20) % 3]
    path = str(tmp_path / "categorical.tif")
    transform = from_bounds(-5.0, 50.0, 5.0, 60.0, width, height)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=width,
        height=height,
        count=1,
        dtype="uint32",
        crs="EPSG:4326",
        transform=transform,
        nodata=255,
        tiled=True,
        blockxsize=512,
        blockysize=512,
    ) as dst:
        dst.write(data, 1)
    return path


@requires_gdalwarp
def test_convert_geotiff_categorical_preserves_codes(categorical_uint32_tif, tmp_path):
    output_path = str(tmp_path / "out.tif")
    _convert_geotiff_to_cog(categorical_uint32_tif, output_path, is_categorical=True)

    allowed = {1, 7, 13, 255}
    with rasterio.open(output_path) as src:
        overviews = src.overviews(1)
        assert overviews, "expected overviews to be built by COG driver"
        for level in overviews:
            data = src.read(
                1,
                out_shape=(
                    max(1, src.height // level),
                    max(1, src.width // level),
                ),
            )
            unique = set(int(v) for v in np.unique(data))
            bleed = unique - allowed
            assert not bleed, (
                f"overview x{level} has non-category values {sorted(bleed)} — "
                "resampling is blending category codes"
            )


@requires_gdalwarp
def test_convert_geotiff_categorical_flag_changes_resampling(
    categorical_uint32_tif, tmp_path
):
    """Without the flag, the COG driver uses its dtype-based default (CUBIC
    for uint32) and boundary-adjacent overviews carry bleed codes. With the
    flag, no bleed. This guards the branching in _convert_geotiff_to_cog."""
    default_out = str(tmp_path / "default.tif")
    categorical_out = str(tmp_path / "categorical.tif")
    _convert_geotiff_to_cog(categorical_uint32_tif, default_out, is_categorical=False)
    _convert_geotiff_to_cog(
        categorical_uint32_tif, categorical_out, is_categorical=True
    )

    allowed = {1, 7, 13, 255}

    def bleed_across_overviews(path: str) -> set[int]:
        out: set[int] = set()
        with rasterio.open(path) as src:
            for level in src.overviews(1):
                data = src.read(
                    1,
                    out_shape=(
                        max(1, src.height // level),
                        max(1, src.width // level),
                    ),
                )
                out |= {int(v) for v in np.unique(data)} - allowed
        return out

    assert bleed_across_overviews(default_out), (
        "expected non-categorical path to produce bleed — otherwise this test "
        "doesn't actually validate the fix"
    )
    assert not bleed_across_overviews(categorical_out)


@requires_gdalwarp
def test_convert_geotiff_continuous_uses_bilinear_default(tmp_path):
    # Smooth float raster — bilinear is appropriate and should not error.
    width, height = 128, 128
    data = np.fromfunction(lambda y, x: (x + y).astype("float32"), (height, width))
    path = str(tmp_path / "continuous.tif")
    transform = from_bounds(-5.0, 50.0, 5.0, 60.0, width, height)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=width,
        height=height,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
        tiled=True,
        blockxsize=64,
        blockysize=64,
    ) as dst:
        dst.write(data, 1)
    output_path = str(tmp_path / "out.tif")
    _convert_geotiff_to_cog(path, output_path, is_categorical=False)
    with rasterio.open(output_path) as src:
        assert src.count == 1
        assert "float" in str(src.dtypes[0])


def test_cog_url_none_for_vector():
    converted_key = "datasets/abc-123/converted/data.parquet"
    format_pair = FormatPair.GEOJSON_TO_GEOPARQUET
    cog_url = (
        f"/storage/{converted_key}"
        if format_pair.dataset_type == DatasetType.RASTER
        else None
    )
    assert cog_url is None
