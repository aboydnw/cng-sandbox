"""Tests for sandbox API client."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_get_datasets_returns_list(sandbox_api_url, mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response({
        "datasets": [{"id": "ds_1", "filename": "data.tif", "dataset_type": "raster", "is_example": False}]
    }))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    datasets = await client.get_datasets()
    assert len(datasets) == 1
    assert datasets[0]["id"] == "ds_1"
    mock_http_client.get.assert_called_once_with("http://localhost:8086/api/datasets")


@pytest.mark.asyncio
async def test_get_story_by_id(sandbox_api_url, mock_http_client, sample_story):
    mock_http_client.get = AsyncMock(return_value=_make_response(sample_story))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    story = await client.get_story(story_id="story_xyz789")
    assert story["id"] == "story_xyz789"
    mock_http_client.get.assert_called_once_with("http://localhost:8086/api/stories/story_xyz789")


@pytest.mark.asyncio
async def test_create_story(sandbox_api_url, mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"id": "story_new", "title": "New"}))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    created = await client.create_story(title="New", description="Test", chapters=[])
    assert created["id"] == "story_new"
    mock_http_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_update_story(sandbox_api_url, mock_http_client):
    mock_http_client.patch = AsyncMock(return_value=_make_response({"id": "s1", "title": "Updated"}))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    updated = await client.update_story(story_id="s1", updates={"title": "Updated"})
    assert updated["title"] == "Updated"


@pytest.mark.asyncio
async def test_get_connections(sandbox_api_url, mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response({
        "connections": [{"id": "conn_1", "name": "Test", "url": "https://ex.com/{z}/{x}/{y}.tif", "connection_type": "cog"}]
    }))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    connections = await client.get_connections()
    assert len(connections) == 1
    assert connections[0]["id"] == "conn_1"


@pytest.mark.asyncio
async def test_validate_layer_config(sandbox_api_url, mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"valid": True}))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    result = await client.validate_layer_config(dataset_id="ds_1", colormap="viridis", rescale_min=0, rescale_max=100)
    assert result["valid"] is True
