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


def test_get_job_status_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert "get_job_status" in names


def test_ingest_url_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert "ingest_url" in names


def test_remote_tools_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert {"discover_remote", "connect_remote_temporal"} <= names


def test_upload_story_asset_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert "upload_story_asset" in names


def test_connection_mutation_tools_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert {"update_connection_colormap", "update_connection_categories", "delete_connection"} <= names
