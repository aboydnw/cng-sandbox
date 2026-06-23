import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.export import export_story_interactive_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


@pytest.mark.asyncio
async def test_export_story_interactive_tool_writes_file(tmp_path, mock_http_client):
    resp = MagicMock()
    resp.content = b"PK\x03\x04zipbytes"
    resp.raise_for_status = MagicMock()
    mock_http_client.post = AsyncMock(return_value=resp)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    out = tmp_path / "story.zip"
    result = await export_story_interactive_tool(client, story_id="s1", output_path=str(out))
    assert isinstance(result, TextContent)
    assert out.exists()
    assert out.read_bytes().startswith(b"PK")
    assert str(out) in result.text


@pytest.mark.asyncio
async def test_export_story_interactive_tool_surfaces_400(tmp_path, mock_http_client):
    request = httpx.Request("POST", "http://localhost:8086/api/stories/s1/export/interactive")
    error_resp = httpx.Response(400, json={"detail": "missing scrolly snapshots"}, request=request)
    mock_http_client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError("400", request=request, response=error_resp))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await export_story_interactive_tool(client, story_id="s1", output_path=str(tmp_path / "o.zip"))
    assert "Error" in result.text
    assert "scrolly" in result.text
