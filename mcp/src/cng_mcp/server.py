"""MCP Server for CNG Sandbox."""

import argparse
import asyncio
import logging
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, Resource, TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools import (
    read_datasets_tool,
    read_story_tool,
    create_story_tool,
    update_story_tool,
    read_connections_tool,
    validate_layer_config_tool,
)
from cng_mcp.resources import (
    list_datasets_resource,
    list_story_templates_resource,
    list_colormaps_resource,
)

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS = [
    Tool(
        name="read_datasets",
        description="List all datasets in the workspace with metadata (ID, type, bounds, CRS).",
        inputSchema={"type": "object", "properties": {}, "required": []},
    ),
    Tool(
        name="read_story",
        description="Get story metadata and chapters by story ID.",
        inputSchema={
            "type": "object",
            "properties": {"story_id": {"type": "string", "description": "Story ID"}},
            "required": ["story_id"],
        },
    ),
    Tool(
        name="create_story",
        description="Create a new story with a title, description, and chapters.",
        inputSchema={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "chapters": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "List of chapter objects with title, text, dataset_id, map_state, layer_config",
                },
            },
            "required": ["title", "description", "chapters"],
        },
    ),
    Tool(
        name="update_story",
        description="Update an existing story's title, description, or chapters.",
        inputSchema={
            "type": "object",
            "properties": {
                "story_id": {"type": "string"},
                "updates": {"type": "object", "description": "Fields to update"},
            },
            "required": ["story_id", "updates"],
        },
    ),
    Tool(
        name="read_connections",
        description="List external tile source connections (COG, PMTiles, XYZ URLs).",
        inputSchema={"type": "object", "properties": {}, "required": []},
    ),
    Tool(
        name="validate_layer_config",
        description="Validate a layer configuration (dataset + colormap + rescale range) before creating a chapter.",
        inputSchema={
            "type": "object",
            "properties": {
                "dataset_id": {"type": "string"},
                "colormap": {"type": "string"},
                "rescale_min": {"type": "number"},
                "rescale_max": {"type": "number"},
            },
            "required": ["dataset_id", "colormap"],
        },
    ),
]

RESOURCE_DEFINITIONS = [
    Resource(
        uri="cng://datasets",
        name="Available Datasets",
        description="Catalog of all datasets in workspace",
        mimeType="text/markdown",
    ),
    Resource(
        uri="cng://story-templates",
        name="Story Templates",
        description="Pre-built story templates for agent-driven creation",
        mimeType="text/markdown",
    ),
    Resource(
        uri="cng://colormaps",
        name="Available Colormaps",
        description="Valid colormap names for layer configuration",
        mimeType="text/markdown",
    ),
]


def create_server(sandbox_api_url: str, workspace_id: str | None = None) -> Server:
    """Create and configure MCP server."""
    server: Server = Server("cng-sandbox")
    client = SandboxAPIClient(api_url=sandbox_api_url, workspace_id=workspace_id)

    @server.list_tools()
    async def handle_list_tools() -> list[Tool]:
        return TOOL_DEFINITIONS

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        if name == "read_datasets":
            return [await read_datasets_tool(client)]
        if name == "read_story":
            return [await read_story_tool(client, story_id=arguments["story_id"])]
        if name == "create_story":
            return [await create_story_tool(
                client,
                title=arguments["title"],
                description=arguments["description"],
                chapters=arguments["chapters"],
            )]
        if name == "update_story":
            return [await update_story_tool(
                client,
                story_id=arguments["story_id"],
                updates=arguments["updates"],
            )]
        if name == "read_connections":
            return [await read_connections_tool(client)]
        if name == "validate_layer_config":
            return [await validate_layer_config_tool(
                client,
                dataset_id=arguments["dataset_id"],
                colormap=arguments["colormap"],
                rescale_min=arguments.get("rescale_min"),
                rescale_max=arguments.get("rescale_max"),
            )]
        raise ValueError(f"Unknown tool: {name}")

    @server.list_resources()
    async def handle_list_resources() -> list[Resource]:
        return RESOURCE_DEFINITIONS

    @server.read_resource()
    async def handle_read_resource(uri: str) -> str:
        if uri == "cng://datasets":
            return await list_datasets_resource(client)
        if uri == "cng://story-templates":
            return await list_story_templates_resource()
        if uri == "cng://colormaps":
            return await list_colormaps_resource()
        raise ValueError(f"Unknown resource: {uri}")

    return server


async def main():
    """Run the MCP server via stdio."""
    parser = argparse.ArgumentParser(description="CNG MCP Server")
    parser.add_argument(
        "--api-url",
        default=os.getenv("SANDBOX_API_URL", "http://localhost:8086"),
        help="Sandbox API URL (default: http://localhost:8086)",
    )
    parser.add_argument(
        "--workspace-id",
        default=os.getenv("SANDBOX_WORKSPACE_ID"),
        help="Workspace ID to scope requests (sent as X-Workspace-Id). "
        "Defaults to $SANDBOX_WORKSPACE_ID. Without it, workspace-listing "
        "endpoints will return empty lists.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    server = create_server(
        sandbox_api_url=args.api_url, workspace_id=args.workspace_id
    )
    logger.info(
        "CNG MCP Server starting (API: %s, workspace: %s)",
        args.api_url,
        args.workspace_id or "<none>",
    )

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main_cli():
    """Synchronous entry point for CLI script."""
    asyncio.run(main())


if __name__ == "__main__":
    main_cli()
