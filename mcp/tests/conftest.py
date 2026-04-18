"""Pytest fixtures for MCP server tests."""

import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def sandbox_api_url() -> str:
    return "http://localhost:8086"


@pytest.fixture
def mock_http_client():
    return AsyncMock()


@pytest.fixture
def sample_dataset():
    return {
        "id": "dataset_abc123",
        "filename": "elevation.tif",
        "created_at": "2025-01-01T00:00:00Z",
        "dataset_type": "raster",
        "metadata": {
            "bbox": [-180, -90, 180, 90],
            "crs": "EPSG:4326",
            "bands": 1,
        },
        "tile_url": "/raster/tileset/dataset_abc123/tiles/{z}/{x}/{y}.png",
        "is_example": False,
    }


@pytest.fixture
def sample_story():
    return {
        "id": "story_xyz789",
        "title": "Global Elevation Analysis",
        "description": "An exploration of terrain worldwide",
        "chapters": [
            {
                "id": "ch_001",
                "order": 0,
                "type": "scrollytelling",
                "title": "Overview",
                "narrative": "Starting with global coverage...",
                "transition": "fly-to",
                "overlay_position": "left",
                "map_state": {
                    "center": [0, 0],
                    "zoom": 2,
                    "bearing": 0,
                    "pitch": 0,
                    "basemap": "dark",
                },
                "layer_config": {
                    "dataset_id": "dataset_abc123",
                    "colormap": "viridis",
                    "opacity": 0.8,
                    "basemap": "dark",
                },
            }
        ],
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_connection():
    return {
        "id": "conn_def456",
        "name": "GEBCO Bathymetry",
        "url": "https://example.com/gebco/{z}/{x}/{y}.tif",
        "connection_type": "cog",
        "is_categorical": False,
        "categories": None,
    }
