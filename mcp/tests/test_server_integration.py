"""Integration tests for MCP server."""

import pytest


@pytest.mark.asyncio
async def test_server_creation(sandbox_api_url):
    from cng_mcp.server import create_server
    server = create_server(sandbox_api_url=sandbox_api_url)
    assert server is not None
    assert server.name == "cng-sandbox"


@pytest.mark.asyncio
async def test_server_lists_tools(sandbox_api_url):
    """Verify server has registered request handlers."""
    from cng_mcp.server import create_server
    server = create_server(sandbox_api_url=sandbox_api_url)
    assert len(server.request_handlers) > 0
