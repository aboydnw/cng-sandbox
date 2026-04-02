import os
import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_bounds


def _create_test_cog(path: str, bounds=(-10.0, -10.0, 10.0, 10.0), crs="EPSG:4326"):
    """Create a minimal 4x4 GeoTIFF for testing."""
    west, south, east, north = bounds
    transform = from_bounds(west, south, east, north, 4, 4)
    data = np.ones((1, 4, 4), dtype=np.uint8)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=4,
        width=4,
        count=1,
        dtype="uint8",
        crs=crs,
        transform=transform,
    ) as dst:
        dst.write(data)


def test_ingest_raster_builds_valid_stac():
    from src.services.stac_ingest import build_stac_collection, build_stac_item

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_path = os.path.join(tmpdir, "test.tif")
        _create_test_cog(cog_path)

        item = build_stac_item(
            cog_path=cog_path,
            dataset_id="abc-123",
            collection_id="sandbox-abc-123",
            item_id="abc-123-data",
            s3_href="s3://bucket/datasets/abc-123/converted/test.tif",
        )

        item.validate()
        item_dict = item.to_dict()

        assert item_dict["id"] == "abc-123-data"
        assert item_dict["collection"] == "sandbox-abc-123"
        assert (
            item_dict["assets"]["data"]["href"]
            == "s3://bucket/datasets/abc-123/converted/test.tif"
        )
        assert (
            item_dict["assets"]["data"]["type"]
            == "image/tiff; application=geotiff; profile=cloud-optimized"
        )
        assert len(item_dict["bbox"]) == 4

        collection = build_stac_collection(
            collection_id="sandbox-abc-123",
            description="User upload: test.tif",
            item=item,
        )

        collection.validate()
        col_dict = collection.to_dict()

        assert col_dict["id"] == "sandbox-abc-123"
        assert col_dict["extent"]["spatial"]["bbox"] == [list(item.bbox)]


def test_ingest_temporal_builds_valid_stac():
    from datetime import datetime

    from src.services.stac_ingest import build_stac_collection, build_stac_item

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_paths = []
        datetimes = [
            "2015-01-01T00:00:00Z",
            "2016-01-01T00:00:00Z",
            "2017-01-01T00:00:00Z",
        ]

        for i in range(3):
            path = os.path.join(tmpdir, f"timestep_{i}.tif")
            _create_test_cog(path, bounds=(-180, -90, 180, 90))
            cog_paths.append(path)

        items = []
        for i, (cog_path, dt) in enumerate(zip(cog_paths, datetimes, strict=False)):
            item = build_stac_item(
                cog_path=cog_path,
                dataset_id="abc123",
                collection_id="sandbox-abc123",
                item_id=f"abc123-{i}",
                s3_href=f"s3://bucket/datasets/abc123/timesteps/{i}/data.tif",
                input_datetime=datetime.fromisoformat(dt),
            )
            item.validate()
            items.append(item)

        assert items[0].datetime.year == 2015
        assert items[2].datetime.year == 2017

        collection = build_stac_collection(
            collection_id="sandbox-abc123",
            description="Temporal upload: sst",
            bbox=list(items[0].bbox),
            temporal_start=datetimes[0],
            temporal_end=datetimes[-1],
        )
        collection.validate()

        col_dict = collection.to_dict()
        interval = col_dict["extent"]["temporal"]["interval"]
        assert len(interval) == 1
        assert len(interval[0]) == 2
        start_str, end_str = interval[0]
        assert start_str.startswith("2015-01-01")
        assert end_str.startswith("2017-01-01")


def test_geometry_is_valid_geojson():
    from src.services.stac_ingest import build_stac_item

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_path = os.path.join(tmpdir, "test.tif")
        _create_test_cog(cog_path, bounds=(-122.5, 37.5, -122.0, 38.0), crs="EPSG:4326")

        item = build_stac_item(
            cog_path=cog_path,
            dataset_id="geo-test",
            collection_id="sandbox-geo-test",
            item_id="geo-test-data",
            s3_href="s3://bucket/test.tif",
        )

        geom = item.geometry
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"]) == 1
        ring = geom["coordinates"][0]
        assert ring[0] == ring[-1]  # closed ring

        assert -123 < item.bbox[0] < -121
        assert 37 < item.bbox[1] < 39


class TestBuildStacItemFromHref:
    def test_builds_item_with_remote_href(self):
        from src.services.stac_ingest import build_stac_item_from_href

        item = build_stac_item_from_href(
            href="https://data.example.com/scene_01.tif",
            dataset_id="abc123",
            collection_id="sandbox-abc123",
            item_id="abc123-0",
            bbox=[-180, -90, 180, 90],
            geometry={
                "type": "Polygon",
                "coordinates": [
                    [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
                ],
            },
        )
        assert item.id == "abc123-0"
        assert item.assets["data"].href == "https://data.example.com/scene_01.tif"
        assert list(item.bbox) == [-180, -90, 180, 90]

    def test_sets_collection_id(self):
        from src.services.stac_ingest import build_stac_item_from_href

        item = build_stac_item_from_href(
            href="s3://bucket/scene.tif",
            dataset_id="abc123",
            collection_id="sandbox-abc123",
            item_id="abc123-0",
            bbox=[-10, -10, 10, 10],
            geometry={
                "type": "Polygon",
                "coordinates": [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]],
            },
        )
        assert item.collection_id == "sandbox-abc123"

    def test_uses_provided_datetime(self):
        from datetime import UTC, datetime

        from src.services.stac_ingest import build_stac_item_from_href

        dt = datetime(2020, 6, 15, tzinfo=UTC)
        item = build_stac_item_from_href(
            href="s3://bucket/scene.tif",
            dataset_id="abc123",
            collection_id="sandbox-abc123",
            item_id="abc123-0",
            bbox=[-10, -10, 10, 10],
            geometry={
                "type": "Polygon",
                "coordinates": [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]],
            },
            input_datetime=dt,
        )
        assert item.datetime == dt

    def test_asset_has_cog_media_type(self):
        from src.services.stac_ingest import COG_MEDIA_TYPE, build_stac_item_from_href

        item = build_stac_item_from_href(
            href="https://data.example.com/scene.tif",
            dataset_id="abc123",
            collection_id="sandbox-abc123",
            item_id="abc123-0",
            bbox=[-10, -10, 10, 10],
            geometry={
                "type": "Polygon",
                "coordinates": [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]],
            },
        )
        assert item.assets["data"].media_type == COG_MEDIA_TYPE
