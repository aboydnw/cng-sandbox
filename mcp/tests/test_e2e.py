"""End-to-end tests for MCP server workflows."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools.datasets import read_datasets_tool
from cng_mcp.tools.stories import create_story_tool
from cng_mcp.tools.validation import validate_layer_config_tool


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_e2e_agent_discover_datasets(mock_http_client, sample_dataset):
    """E2E: Agent discovers available datasets."""
    mock_http_client.get = AsyncMock(return_value=_make_response({"datasets": [sample_dataset]}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await read_datasets_tool(client)
    assert isinstance(result, TextContent)
    assert "elevation.tif" in result.text


@pytest.mark.asyncio
async def test_e2e_agent_validates_then_creates_story(mock_http_client):
    """E2E: Agent validates layer config before creating a story."""
    mock_http_client.post = AsyncMock(return_value=_make_response({"valid": True}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)

    validation = await validate_layer_config_tool(
        client, dataset_id="ds_1", colormap="viridis", rescale_min=0, rescale_max=100
    )
    assert "Valid" in validation.text

    mock_http_client.post = AsyncMock(return_value=_make_response({"id": "story_agent_001"}))
    chapters = [{
        "title": "Overview",
        "text": "Global view of elevation data",
        "dataset_id": "ds_1",
        "map_state": {"center": [0, 0], "zoom": 2},
        "layer_config": {"colormap": "viridis", "rescale_min": 0, "rescale_max": 100},
    }]
    result = await create_story_tool(
        client,
        title="Agent-Created Story",
        description="Automatically created by an agent",
        chapters=chapters,
    )
    assert "story_agent_001" in result.text
