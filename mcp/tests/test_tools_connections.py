"""Tests for connection tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.connections import read_connections_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_read_connections_tool(mock_http_client, sample_connection):
    mock_http_client.get = AsyncMock(return_value=_make_response([sample_connection]))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_connections_tool(client)
    assert isinstance(result, TextContent)
    assert "GEBCO Bathymetry" in result.text
    assert "cog" in result.text


@pytest.mark.asyncio
async def test_read_connections_tool_empty(mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response([]))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_connections_tool(client)
    assert "No external connections" in result.text
