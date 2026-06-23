import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.ingest import ingest_url_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data, status_code=200):
    response = MagicMock()
    response.status_code = status_code
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_ingest_url_waits_for_ready(mock_http_client):
    post_resp = _make_response({"job_id": "j1", "dataset_id": "ds1"}, status_code=202)
    mock_http_client.post = AsyncMock(return_value=post_resp)
    mock_http_client.get = AsyncMock(return_value=_make_response(
        {"id": "j1", "status": "ready", "dataset_id": "ds1"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await ingest_url_tool(client, url="https://example.com/x.geojson", timeout=10)
    assert isinstance(result, TextContent)
    assert "ds1" in result.text
    assert "ready" in result.text.lower()


@pytest.mark.asyncio
async def test_ingest_url_reports_failure(mock_http_client):
    post_resp = _make_response({"job_id": "j1", "dataset_id": "ds1"}, status_code=202)
    mock_http_client.post = AsyncMock(return_value=post_resp)
    mock_http_client.get = AsyncMock(return_value=_make_response(
        {"id": "j1", "status": "failed", "error": "unsupported format"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await ingest_url_tool(client, url="https://example.com/x.weird", timeout=10)
    assert "failed" in result.text.lower()
    assert "unsupported format" in result.text


@pytest.mark.asyncio
async def test_ingest_url_requires_url(mock_http_client):
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await ingest_url_tool(client, url="")
    assert "Error" in result.text
