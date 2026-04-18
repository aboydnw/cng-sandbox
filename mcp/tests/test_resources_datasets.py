"""Tests for datasets resource."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from cng_mcp.resources.datasets import list_datasets_resource
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_list_datasets_resource_empty(mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response([]))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    content = await list_datasets_resource(client)
    assert "No datasets available" in content


@pytest.mark.asyncio
async def test_list_datasets_resource_with_data(mock_http_client, sample_dataset):
    mock_http_client.get = AsyncMock(return_value=_make_response([sample_dataset]))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    content = await list_datasets_resource(client)
    assert "Available Datasets" in content
    assert "elevation.tif" in content
    assert "EPSG:4326" in content
