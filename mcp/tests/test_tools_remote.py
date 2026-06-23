import pytest
from unittest.mock import AsyncMock, MagicMock
from cng_mcp.tools.remote import discover_remote_tool, connect_remote_temporal_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.status_code = 200
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_discover_remote_tool(mock_http_client):
    body = {"files": [{"url": "https://x/a.tif", "filename": "a.tif"},
                      {"url": "https://x/b.tif", "filename": "b.tif"}],
            "count": 2, "dominant_extension": ".tif"}
    mock_http_client.post = AsyncMock(return_value=_make_response(body))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await discover_remote_tool(client, url="https://x/")
    assert "2" in result.text
    assert "a.tif" in result.text


@pytest.mark.asyncio
async def test_connect_remote_temporal_with_explicit_files(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"job_id": "j1", "dataset_id": "ds1"}))
    mock_http_client.get = AsyncMock(return_value=_make_response(
        {"id": "j1", "status": "ready", "dataset_id": "ds1"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    files = [{"url": "https://x/a.tif", "filename": "a.tif"}]
    result = await connect_remote_temporal_tool(client, url="https://x/", mode="temporal", files=files, timeout=10)
    assert "ds1" in result.text
    assert "ready" in result.text.lower()


@pytest.mark.asyncio
async def test_connect_remote_temporal_rejects_bad_mode(mock_http_client):
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await connect_remote_temporal_tool(client, url="https://x/", mode="banana", files=[{"url": "u", "filename": "f"}])
    assert "Error" in result.text
