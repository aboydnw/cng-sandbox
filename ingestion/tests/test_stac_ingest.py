import os
import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_bounds

from geojson_pydantic import Polygon as GeoJsonPolygon


def _create_test_cog(path: str, bounds=(-10.0, -10.0, 10.0, 10.0), crs="EPSG:4326"):
    """Create a minimal 4x4 GeoTIFF for testing."""
    west, south, east, north = bounds
    transform = from_bounds(west, south, east, north, 4, 4)
    data = np.ones((1, 4, 4), dtype=np.uint8)
    with rasterio.open(
        path, "w", driver="GTiff", height=4, width=4,
        count=1, dtype="uint8", crs=crs, transform=transform,
    ) as dst:
        dst.write(data)


def test_ingest_raster_builds_valid_stac():
    from src.services.stac_ingest import build_stac_item, build_stac_collection

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
        assert item_dict["assets"]["data"]["href"] == "s3://bucket/datasets/abc-123/converted/test.tif"
        assert item_dict["assets"]["data"]["type"] == "image/tiff; application=geotiff; profile=cloud-optimized"
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
