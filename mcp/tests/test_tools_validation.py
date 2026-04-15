"""Tests for validation tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.validation import validate_layer_config_tool
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_validate_layer_config_valid(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"valid": True}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await validate_layer_config_tool(client, dataset_id="ds_1", colormap="viridis")
    assert isinstance(result, TextContent)
    assert "Valid" in result.text


@pytest.mark.asyncio
async def test_validate_layer_config_invalid(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({
        "valid": False,
        "error": "Unknown colormap: 'invalid_map'"
    }))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await validate_layer_config_tool(client, dataset_id="ds_1", colormap="invalid_map")
    assert isinstance(result, TextContent)
    assert "Invalid" in result.text
    assert "Unknown colormap" in result.text


@pytest.mark.asyncio
async def test_validate_layer_config_with_rescale(mock_http_client):
    mock_http_client.post = AsyncMock(return_value=_make_response({"valid": True}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await validate_layer_config_tool(
        client, dataset_id="ds_1", colormap="viridis", rescale_min=0, rescale_max=100
    )
    assert "Rescale" in result.text
    assert "0" in result.text and "100" in result.text
