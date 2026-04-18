"""Tests for story tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.stories import read_story_tool, create_story_tool, update_story_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_read_story_tool(mock_http_client, sample_story):
    mock_http_client.get = AsyncMock(return_value=_make_response(sample_story))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_story_tool(client, story_id="story_xyz789")
    assert isinstance(result, TextContent)
    assert "Global Elevation Analysis" in result.text
    assert "Overview" in result.text
    # Chapter narrative and dataset reference both come from the nested
    # layer_config / narrative fields, not a flat text/dataset_id.
    assert "Starting with global coverage" in result.text
    assert "dataset_abc123" in result.text


@pytest.mark.asyncio
async def test_create_story_tool(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"id": "story_new_123"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await create_story_tool(client, title="Test Story", description="A test", chapters=[])
    assert isinstance(result, TextContent)
    assert "story_new_123" in result.text


@pytest.mark.asyncio
async def test_update_story_tool(mock_http_client):
    mock_http_client.patch = AsyncMock(return_value=_make_response({"id": "s1", "title": "Updated"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await update_story_tool(client, story_id="s1", updates={"title": "Updated"})
    assert isinstance(result, TextContent)
    assert "s1" in result.text
