"""Integration tests for MCP server."""

import httpx
import pytest
from mcp import types
from pydantic import AnyUrl

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.server import create_server
from cng_mcp.tools import read_datasets_tool


async def read_resource(server, uri: str) -> str:
    handler = server.request_handlers[types.ReadResourceRequest]
    request = types.ReadResourceRequest(
        method="resources/read",
        params=types.ReadResourceRequestParams(uri=AnyUrl(uri)),
    )
    result = await handler(request)
    return result.root.contents[0].text


@pytest.mark.asyncio
async def test_server_creation(sandbox_api_url):
    server = create_server(sandbox_api_url=sandbox_api_url)
    assert server is not None
    assert server.name == "cng-sandbox"


@pytest.mark.asyncio
async def test_server_lists_tools(sandbox_api_url):
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


def test_export_story_interactive_registered():
    from cng_mcp.server import TOOL_DEFINITIONS
    names = {t.name for t in TOOL_DEFINITIONS}
    assert "export_story_interactive" in names


@pytest.mark.asyncio
async def test_read_resource_datasets(sandbox_api_url, monkeypatch, sample_dataset):
    async def fake_get_datasets(self):
        return [sample_dataset]

    monkeypatch.setattr(SandboxAPIClient, "get_datasets", fake_get_datasets)
    server = create_server(sandbox_api_url=sandbox_api_url)

    text = await read_resource(server, "cng://datasets")

    assert sample_dataset["filename"] in text
    assert sample_dataset["id"] in text


@pytest.mark.asyncio
async def test_read_resource_story_templates(sandbox_api_url):
    server = create_server(sandbox_api_url=sandbox_api_url)

    text = await read_resource(server, "cng://story-templates")

    assert text.strip()


@pytest.mark.asyncio
async def test_read_resource_colormaps(sandbox_api_url):
    server = create_server(sandbox_api_url=sandbox_api_url)

    text = await read_resource(server, "cng://colormaps")

    assert "viridis" in text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "uri", ["cng://datasets/", "cng://story-templates/", "cng://colormaps/"]
)
async def test_read_resource_accepts_trailing_slash(
    sandbox_api_url, monkeypatch, sample_dataset, uri
):
    async def fake_get_datasets(self):
        return [sample_dataset]

    monkeypatch.setattr(SandboxAPIClient, "get_datasets", fake_get_datasets)
    server = create_server(sandbox_api_url=sandbox_api_url)

    text = await read_resource(server, uri)

    assert text.strip()


@pytest.mark.asyncio
async def test_read_resource_unknown_uri_raises(sandbox_api_url):
    server = create_server(sandbox_api_url=sandbox_api_url)

    with pytest.raises(Exception):
        await read_resource(server, "cng://nope")


@pytest.mark.asyncio
async def test_tool_surfaces_api_error_detail(sandbox_api_url, monkeypatch):
    request = httpx.Request("GET", f"{sandbox_api_url}/api/datasets")
    response = httpx.Response(
        422,
        request=request,
        text='{"detail": "Unknown colormap: not-a-colormap"}',
    )

    async def fake_get_datasets(self):
        raise httpx.HTTPStatusError("error", request=request, response=response)

    monkeypatch.setattr(SandboxAPIClient, "get_datasets", fake_get_datasets)
    client = SandboxAPIClient(api_url=sandbox_api_url)

    result = await read_datasets_tool(client)

    assert "Unknown colormap: not-a-colormap" in result.text
    assert "422" in result.text
