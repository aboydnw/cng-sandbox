"""Tests for connection tools."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.connections import create_connection_tool, read_connections_tool
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


@pytest.mark.asyncio
async def test_create_connection_tool_zarr(mock_http_client):
    created = {
        "id": "conn_zarr_001",
        "name": "AEF Mosaic",
        "url": "s3://us-west-2.opendata.source.coop/tge-labs/aef-mosaic/",
        "connection_type": "zarr",
    }
    mock_http_client.post = AsyncMock(return_value=_make_response(created))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await create_connection_tool(
        client,
        name="AEF Mosaic",
        url="s3://us-west-2.opendata.source.coop/tge-labs/aef-mosaic/",
        connection_type="zarr",
    )
    assert isinstance(result, TextContent)
    assert "conn_zarr_001" in result.text
    assert "AEF Mosaic" in result.text


@pytest.mark.asyncio
async def test_create_connection_tool_geoparquet(mock_http_client):
    created = {
        "id": "conn_gp_001",
        "name": "Iowa AEF Zonal Stats",
        "url": "s3://wherobots-examples/rasterflow/vectors/iowa_aef_zonal_stats/",
        "connection_type": "geoparquet",
    }
    mock_http_client.post = AsyncMock(return_value=_make_response(created))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await create_connection_tool(
        client,
        name="Iowa AEF Zonal Stats",
        url="s3://wherobots-examples/rasterflow/vectors/iowa_aef_zonal_stats/",
        connection_type="geoparquet",
    )
    assert isinstance(result, TextContent)
    assert "conn_gp_001" in result.text


@pytest.mark.asyncio
async def test_create_connection_tool_requires_fields(mock_http_client):
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await create_connection_tool(client, name="", url="s3://x/", connection_type="zarr")
    assert "Error" in result.text
