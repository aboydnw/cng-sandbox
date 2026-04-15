"""Tests for dataset tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.datasets import read_datasets_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_read_datasets_tool_empty(mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response({"datasets": []}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_datasets_tool(client)
    assert isinstance(result, TextContent)
    assert "No datasets" in result.text


@pytest.mark.asyncio
async def test_read_datasets_tool_with_data(mock_http_client, sample_dataset):
    mock_http_client.get = AsyncMock(return_value=_make_response({"datasets": [sample_dataset]}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_datasets_tool(client)
    assert "elevation.tif" in result.text
    assert "dataset_abc123" in result.text
