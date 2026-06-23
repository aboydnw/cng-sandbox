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
    mock_http_client.get = AsyncMock(return_value=_make_response(
        [{"id": "ds_1", "filename": "data.tif", "dataset_type": "raster", "is_example": False}]
    ))
    client = SandboxAPIClient(
        api_url=sandbox_api_url, workspace_id="ws12345x", http_client=mock_http_client
    )
    datasets = await client.get_datasets()
    assert len(datasets) == 1
    assert datasets[0]["id"] == "ds_1"
    mock_http_client.get.assert_called_once_with(
        "http://localhost:8086/api/datasets",
        headers={"X-Workspace-Id": "ws12345x"},
    )


@pytest.mark.asyncio
async def test_get_datasets_without_workspace_sends_no_header(
    sandbox_api_url, mock_http_client
):
    mock_http_client.get = AsyncMock(return_value=_make_response([]))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    await client.get_datasets()
    mock_http_client.get.assert_called_once_with(
        "http://localhost:8086/api/datasets", headers={}
    )


@pytest.mark.asyncio
async def test_get_story_by_id(sandbox_api_url, mock_http_client, sample_story):
    mock_http_client.get = AsyncMock(return_value=_make_response(sample_story))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    story = await client.get_story(story_id="story_xyz789")
    assert story["id"] == "story_xyz789"
    mock_http_client.get.assert_called_once_with(
        "http://localhost:8086/api/stories/story_xyz789", headers={}
    )


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
    mock_http_client.get = AsyncMock(return_value=_make_response(
        [{"id": "conn_1", "name": "Test", "url": "https://ex.com/{z}/{x}/{y}.tif", "connection_type": "cog"}]
    ))
    client = SandboxAPIClient(
        api_url=sandbox_api_url, workspace_id="ws87654x", http_client=mock_http_client
    )
    connections = await client.get_connections()
    assert len(connections) == 1
    assert connections[0]["id"] == "conn_1"
    mock_http_client.get.assert_called_once_with(
        "http://localhost:8086/api/connections",
        headers={"X-Workspace-Id": "ws87654x"},
    )


@pytest.mark.asyncio
async def test_validate_layer_config(sandbox_api_url, mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"valid": True}))
    client = SandboxAPIClient(api_url=sandbox_api_url, http_client=mock_http_client)
    result = await client.validate_layer_config(dataset_id="ds_1", colormap="viridis", rescale_min=0, rescale_max=100)
    assert result["valid"] is True


@pytest.mark.asyncio
async def test_get_job(mock_http_client):
    job = {"id": "job1", "status": "ready", "dataset_id": "ds1"}
    mock_http_client.get = AsyncMock(return_value=_make_response(job))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.get_job("job1")
    assert result["status"] == "ready"
    mock_http_client.get.assert_awaited_once()
    assert "/api/jobs/job1" in mock_http_client.get.call_args.args[0]


@pytest.mark.asyncio
async def test_convert_url_success(mock_http_client):
    resp = _make_response({"job_id": "j1", "dataset_id": "ds1"})
    resp.status_code = 202
    mock_http_client.post = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.convert_url("https://example.com/x.geojson")
    assert result["dataset_id"] == "ds1"


@pytest.mark.asyncio
async def test_convert_url_duplicate_returns_existing(mock_http_client):
    resp = MagicMock()
    resp.status_code = 409
    resp.json = MagicMock(return_value={"detail": "duplicate_dataset", "dataset_id": "ds9", "filename": "x.geojson"})
    mock_http_client.post = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.convert_url("https://example.com/x.geojson")
    assert result["dataset_id"] == "ds9"
    assert result["detail"] == "duplicate_dataset"


@pytest.mark.asyncio
async def test_discover(mock_http_client):
    body = {"files": [{"url": "https://x/a.tif", "filename": "a.tif"}], "count": 1, "dominant_extension": ".tif"}
    mock_http_client.post = AsyncMock(return_value=_make_response(body))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.discover("https://x/")
    assert result["count"] == 1


@pytest.mark.asyncio
async def test_connect_remote(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"job_id": "j1", "dataset_id": "ds1"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    files = [{"url": "https://x/a.tif", "filename": "a.tif"}]
    result = await client.connect_remote("https://x/", "temporal", files)
    assert result["dataset_id"] == "ds1"


@pytest.mark.asyncio
async def test_upload_story_asset(mock_http_client):
    resp = _make_response({"asset_id": "a1", "url": "/api/story-assets/a1/data",
                           "thumbnail_url": "/t", "width": 100, "height": 80})
    mock_http_client.post = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.upload_story_asset(b"\x89PNG", "cover.png", "image/png", "image")
    assert result["asset_id"] == "a1"
    kwargs = mock_http_client.post.call_args.kwargs
    assert "files" in kwargs and "data" in kwargs
    assert kwargs["data"]["kind"] == "image"


@pytest.mark.asyncio
async def test_update_connection_colormap(mock_http_client):
    mock_http_client.patch = AsyncMock(return_value=_make_response({"id": "c1", "preferred_colormap": "blues"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await client.update_connection_colormap("c1", "blues", False)
    assert result["preferred_colormap"] == "blues"
    assert "/api/connections/c1/colormap" in mock_http_client.patch.call_args.args[0]


@pytest.mark.asyncio
async def test_update_connection_categories(mock_http_client):
    mock_http_client.patch = AsyncMock(return_value=_make_response({"id": "c1"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    await client.update_connection_categories("c1", [{"value": 1, "label": "Flood", "color": "#6138BE"}])
    assert "/api/connections/c1/categories" in mock_http_client.patch.call_args.args[0]


@pytest.mark.asyncio
async def test_delete_connection(mock_http_client):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    mock_http_client.delete = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    await client.delete_connection("c1")
    assert "/api/connections/c1" in mock_http_client.delete.call_args.args[0]


@pytest.mark.asyncio
async def test_export_story_interactive(mock_http_client):
    resp = MagicMock()
    resp.content = b"PK\x03\x04zipbytes"
    resp.raise_for_status = MagicMock()
    mock_http_client.post = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    data = await client.export_story_interactive("story1")
    assert data.startswith(b"PK")
    assert "/api/stories/story1/export/interactive" in mock_http_client.post.call_args.args[0]


@pytest.mark.asyncio
async def test_create_connection(sandbox_api_url, mock_http_client):
    expected = {"id": "conn_123", "name": "Test Zarr", "connection_type": "zarr"}
    mock_http_client.post = AsyncMock(return_value=_make_response(expected))
    client = SandboxAPIClient(
        api_url=sandbox_api_url, workspace_id="ws12345x", http_client=mock_http_client
    )
    result = await client.create_connection(
        name="Test Zarr",
        url="s3://example/zarr/",
        connection_type="zarr",
    )
    assert result["id"] == "conn_123"
    mock_http_client.post.assert_called_once()
    call_kwargs = mock_http_client.post.call_args[1]
    assert call_kwargs["json"]["name"] == "Test Zarr"
    assert call_kwargs["json"]["connection_type"] == "zarr"
    assert call_kwargs["headers"] == {"X-Workspace-Id": "ws12345x"}
