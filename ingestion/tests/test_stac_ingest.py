from src.services.stac_ingest import build_collection, build_item, build_temporal_collection, build_temporal_item


def test_build_collection():
    col = build_collection(
        dataset_id="abc-123",
        filename="temperature.tif",
        bbox=[-10.0, -10.0, 10.0, 10.0],
    )
    assert col["id"] == "sandbox-abc-123"
    assert col["type"] == "Collection"
    assert col["extent"]["spatial"]["bbox"] == [[-10.0, -10.0, 10.0, 10.0]]
    assert "temporal" in col["extent"]


def test_build_item():
    item = build_item(
        dataset_id="abc-123",
        filename="temperature.tif",
        s3_href="s3://bucket/datasets/abc-123/converted/temperature.tif",
        bbox=[-10.0, -10.0, 10.0, 10.0],
        datetime_str="2026-03-13T00:00:00Z",
    )
    assert item["type"] == "Feature"
    assert item["collection"] == "sandbox-abc-123"
    assert item["assets"]["data"]["href"] == "s3://bucket/datasets/abc-123/converted/temperature.tif"
    assert item["assets"]["data"]["type"] == "image/tiff; application=geotiff; profile=cloud-optimized"
    assert item["bbox"] == [-10.0, -10.0, 10.0, 10.0]
    coords = item["geometry"]["coordinates"][0]
    assert len(coords) == 5  # closed polygon


def test_build_temporal_collection():
    col = build_temporal_collection(
        dataset_id="abc123",
        filename="sst",
        bbox=[-180, -90, 180, 90],
        datetime_start="2015-01-01T00:00:00Z",
        datetime_end="2023-01-01T00:00:00Z",
    )
    assert col["id"] == "sandbox-abc123"
    assert col["extent"]["temporal"]["interval"] == [["2015-01-01T00:00:00Z", "2023-01-01T00:00:00Z"]]


def test_build_temporal_item():
    item = build_temporal_item(
        dataset_id="abc123",
        index=3,
        s3_href="s3://bucket/datasets/abc123/timesteps/3/data.tif",
        bbox=[-180, -90, 180, 90],
        datetime_str="2018-01-01T00:00:00Z",
    )
    assert item["id"] == "abc123-3"
    assert item["collection"] == "sandbox-abc123"
    assert item["properties"]["datetime"] == "2018-01-01T00:00:00Z"
    assert item["assets"]["data"]["href"] == "s3://bucket/datasets/abc123/timesteps/3/data.tif"
