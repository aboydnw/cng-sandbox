"""MCP Server for CNG Sandbox."""

import argparse
import asyncio
import logging
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, Resource, TextContent
from pydantic import AnyUrl

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools import (
    read_datasets_tool,
    read_story_tool,
    create_story_tool,
    update_story_tool,
    read_connections_tool,
    create_connection_tool,
    update_connection_colormap_tool,
    update_connection_categories_tool,
    delete_connection_tool,
    validate_layer_config_tool,
    get_job_status_tool,
    ingest_url_tool,
    discover_remote_tool,
    connect_remote_temporal_tool,
    upload_story_asset_tool,
    export_story_interactive_tool,
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
        name="create_connection",
        description="Create a new external tile source connection (zarr, cog, pmtiles, xyz, geoparquet).",
        inputSchema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Display name for the connection"},
                "url": {"type": "string", "description": "URL or S3 URI for the tile source"},
                "connection_type": {
                    "type": "string",
                    "description": "One of: zarr, cog, pmtiles, xyz, geoparquet",
                },
                "bounds": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "[west, south, east, north] bounding box",
                },
                "min_zoom": {"type": "integer"},
                "max_zoom": {"type": "integer"},
                "tile_type": {"type": "string", "description": "Tile image format (e.g. png, webp)"},
                "band_count": {"type": "integer"},
                "rescale": {"type": "string", "description": "Rescale range as 'min,max'"},
                "config": {"type": "object", "description": "Additional tiler config"},
                "geozarr_attrs": {"type": "object", "description": "GeoZarr-spec attributes"},
            },
            "required": ["name", "url", "connection_type"],
        },
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
    Tool(
        name="get_job_status",
        description="Get the status of a conversion job by job ID (pending/converting/ready/failed).",
        inputSchema={
            "type": "object",
            "properties": {"job_id": {"type": "string"}},
            "required": ["job_id"],
        },
    ),
    Tool(
        name="ingest_url",
        description="Ingest a remote geospatial file (GeoTIFF, GeoJSON, Shapefile .zip, NetCDF, HDF5) into a dataset. Waits for conversion to finish and returns the dataset ID.",
        inputSchema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "HTTP(S) or S3 URL of the file"},
                "wait": {"type": "boolean", "description": "Wait for conversion (default true)"},
                "timeout": {"type": "number", "description": "Max seconds to wait (default 600)"},
            },
            "required": ["url"],
        },
    ),
    Tool(
        name="discover_remote",
        description="List geospatial files at a remote URL or S3 prefix before connecting them.",
        inputSchema={
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
        },
    ),
    Tool(
        name="connect_remote_temporal",
        description="Register remote COGs as a temporal (date-stepped, time-slider) or mosaic dataset. Discovers files at the URL if an explicit file list is not given; waits for the job to finish.",
        inputSchema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL or S3 prefix"},
                "mode": {"type": "string", "description": "'temporal' or 'mosaic' (default temporal)"},
                "files": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Optional explicit [{url, filename}] list; discovered from url if omitted",
                },
                "timeout": {"type": "number"},
            },
            "required": ["url"],
        },
    ),
    Tool(
        name="upload_story_asset",
        description="Upload a local image or CSV file as a story asset (for image chapters and CSV chart chapters). Returns the asset ID and URL.",
        inputSchema={
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Absolute path to a local image or CSV file"},
                "kind": {"type": "string", "description": "'image' or 'csv'"},
                "story_id": {"type": "string", "description": "Optional story to attach the asset to"},
            },
            "required": ["file_path", "kind"],
        },
    ),
    Tool(
        name="update_connection_colormap",
        description="Set the preferred colormap for a raster connection (cog/xyz_raster/raster pmtiles).",
        inputSchema={
            "type": "object",
            "properties": {
                "connection_id": {"type": "string"},
                "colormap": {"type": "string"},
                "reversed": {"type": "boolean"},
            },
            "required": ["connection_id", "colormap"],
        },
    ),
    Tool(
        name="update_connection_categories",
        description="Update category labels/colors for a categorical connection. categories: [{value:int, label?:str, color?:'#RRGGBB'}].",
        inputSchema={
            "type": "object",
            "properties": {
                "connection_id": {"type": "string"},
                "categories": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["connection_id", "categories"],
        },
    ),
    Tool(
        name="delete_connection",
        description="Delete an external tile source connection by ID.",
        inputSchema={
            "type": "object",
            "properties": {"connection_id": {"type": "string"}},
            "required": ["connection_id"],
        },
    ),
    Tool(
        name="export_story_interactive",
        description="Build and download a story's self-contained interactive HTML bundle (.zip) to a local path. Stories with zarr layers or scrolly chapters needing snapshots return an error.",
        inputSchema={
            "type": "object",
            "properties": {
                "story_id": {"type": "string"},
                "output_path": {"type": "string", "description": "Local path to write the .zip"},
            },
            "required": ["story_id", "output_path"],
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
        if name == "create_connection":
            return [await create_connection_tool(
                client,
                name=arguments["name"],
                url=arguments["url"],
                connection_type=arguments["connection_type"],
                bounds=arguments.get("bounds"),
                min_zoom=arguments.get("min_zoom"),
                max_zoom=arguments.get("max_zoom"),
                tile_type=arguments.get("tile_type"),
                band_count=arguments.get("band_count"),
                rescale=arguments.get("rescale"),
                config=arguments.get("config"),
                geozarr_attrs=arguments.get("geozarr_attrs"),
            )]
        if name == "validate_layer_config":
            return [await validate_layer_config_tool(
                client,
                dataset_id=arguments["dataset_id"],
                colormap=arguments["colormap"],
                rescale_min=arguments.get("rescale_min"),
                rescale_max=arguments.get("rescale_max"),
            )]
        if name == "get_job_status":
            return [await get_job_status_tool(client, job_id=arguments["job_id"])]
        if name == "ingest_url":
            return [await ingest_url_tool(
                client,
                url=arguments["url"],
                wait=arguments.get("wait", True),
                timeout=arguments.get("timeout", 600.0),
            )]
        if name == "discover_remote":
            return [await discover_remote_tool(client, url=arguments["url"])]
        if name == "connect_remote_temporal":
            return [await connect_remote_temporal_tool(
                client,
                url=arguments["url"],
                mode=arguments.get("mode", "temporal"),
                files=arguments.get("files"),
                timeout=arguments.get("timeout", 600.0),
            )]
        if name == "upload_story_asset":
            return [await upload_story_asset_tool(
                client,
                file_path=arguments["file_path"],
                kind=arguments["kind"],
                story_id=arguments.get("story_id"),
            )]
        if name == "update_connection_colormap":
            return [await update_connection_colormap_tool(
                client,
                connection_id=arguments["connection_id"],
                colormap=arguments["colormap"],
                reversed=arguments.get("reversed", False),
            )]
        if name == "update_connection_categories":
            return [await update_connection_categories_tool(
                client,
                connection_id=arguments["connection_id"],
                categories=arguments["categories"],
            )]
        if name == "delete_connection":
            return [await delete_connection_tool(client, connection_id=arguments["connection_id"])]
        if name == "export_story_interactive":
            return [await export_story_interactive_tool(
                client,
                story_id=arguments["story_id"],
                output_path=arguments["output_path"],
            )]
        raise ValueError(f"Unknown tool: {name}")

    @server.list_resources()
    async def handle_list_resources() -> list[Resource]:
        return RESOURCE_DEFINITIONS

    @server.read_resource()
    async def handle_read_resource(uri: AnyUrl) -> str:
        uri_str = str(uri).rstrip("/")
        if uri_str == "cng://datasets":
            return await list_datasets_resource(client)
        if uri_str == "cng://story-templates":
            return await list_story_templates_resource()
        if uri_str == "cng://colormaps":
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
