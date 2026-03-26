import importlib
import sys
from unittest.mock import MagicMock, patch

import pytest

from src.models import DatasetType


def test_extract_bounds_raster():
    mock_rasterio = MagicMock()
    mock_src = MagicMock()
    mock_src.crs = "EPSG:4326"
    mock_src.bounds = MagicMock(left=-180.0, bottom=-90.0, right=180.0, top=90.0)
    mock_rasterio.open.return_value.__enter__ = MagicMock(return_value=mock_src)
    mock_rasterio.open.return_value.__exit__ = MagicMock(return_value=False)

    with patch.dict(sys.modules, {"rasterio": mock_rasterio}):
        import src.services.pipeline as pipeline_mod

        importlib.reload(pipeline_mod)
        result = pipeline_mod._extract_bounds("/fake/output.tif", DatasetType.RASTER)

    assert result == [-180.0, -90.0, 180.0, 90.0]


def test_extract_bounds_vector():
    import numpy as np

    mock_gpd = MagicMock()
    mock_gdf = MagicMock()
    mock_gdf.total_bounds = np.array([-73.99, 40.70, -73.97, 40.72])
    mock_gpd.read_parquet.return_value = mock_gdf

    with patch.dict(sys.modules, {"geopandas": mock_gpd}):
        import src.services.pipeline as pipeline_mod

        importlib.reload(pipeline_mod)
        result = pipeline_mod._extract_bounds(
            "/fake/output.parquet", DatasetType.VECTOR
        )

    assert result == pytest.approx([-73.99, 40.70, -73.97, 40.72])
