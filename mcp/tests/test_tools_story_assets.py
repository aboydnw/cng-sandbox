import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.story_assets import upload_story_asset_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_upload_story_asset_tool(tmp_path, mock_http_client):
    f = tmp_path / "cover.png"
    f.write_bytes(b"\x89PNG\r\n")
    mock_http_client.post = AsyncMock(return_value=_make_response(
        {"asset_id": "a1", "url": "/api/story-assets/a1/data", "thumbnail_url": "/t"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await upload_story_asset_tool(client, file_path=str(f), kind="image")
    assert isinstance(result, TextContent)
    assert "a1" in result.text


@pytest.mark.asyncio
async def test_upload_story_asset_tool_missing_file(mock_http_client):
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await upload_story_asset_tool(client, file_path="/nope/missing.png", kind="image")
    assert "Error" in result.text


@pytest.mark.asyncio
async def test_upload_story_asset_tool_bad_kind(tmp_path, mock_http_client):
    f = tmp_path / "x.png"
    f.write_bytes(b"x")
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await upload_story_asset_tool(client, file_path=str(f), kind="movie")
    assert "Error" in result.text
