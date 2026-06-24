# CNG MCP Server

Model Context Protocol (MCP) server for CNG Sandbox. Exposes datasets, stories, connections, and validation as composable tools for agents.

## What is MCP?

MCP is a protocol that lets applications (agents, CLI tools, SDKs) discover and interact with tools and resources in a standardized way. This server makes the CNG Sandbox accessible to any MCP-compatible client.

## Installation

```bash
pip install cngstorytelling-mcp
```

This installs the `cng-mcp` command. To run against your own instance, see the [self-hosting guide](../docs/self-hosting.md).

## Quick Start

### 1. Start the Server

```bash
# Default API URL (http://localhost:8086)
cng-mcp --workspace-id <8-char-id>

# Custom API URL
cng-mcp --api-url http://your-sandbox.com --workspace-id <8-char-id>
```

The server communicates over stdio. Connect with any MCP client.

The ingestion API requires an `X-Workspace-Id` header on workspace-listing endpoints (`/api/datasets`, `/api/connections`, `/api/stories`). Pass `--workspace-id` (or set `SANDBOX_WORKSPACE_ID`) so the server can forward it — without it, listing endpoints return 400.

### 2. Use with Claude Desktop / Code

Add to your MCP client config:

```json
{
  "mcpServers": {
    "cng-sandbox": {
      "command": "cng-mcp",
      "args": ["--api-url", "http://localhost:8086", "--workspace-id", "abcd1234"]
    }
  }
}
```

## Tools

### read_datasets
List all datasets in your workspace with IDs, types, and bounds.

### read_story
Get a story's metadata and chapters.
**Input**: `story_id` (string)

### create_story
Create a new story.
**Input**:
- `title` (string)
- `description` (string)
- `chapters` (array): each with `title`, `narrative`, `map_state`, and `layer_config` (containing `dataset_id` or `connection_id`)

### update_story
Modify an existing story.
**Input**: `story_id`, `updates` (object with changed fields)

### read_connections
List external tile source connections.

### create_connection
Create a new external tile source connection.
**Input**:
- `name` (string)
- `url` (string)
- `connection_type` (string): one of `zarr`, `cog`, `pmtiles`, `xyz`, `geoparquet`
- `bounds` (array, optional): `[west, south, east, north]`
- `min_zoom` / `max_zoom` (integer, optional)
- `tile_type` (string, optional): tile image format (e.g. `png`, `webp`)
- `band_count` (integer, optional)
- `rescale` (string, optional): range as `"min,max"`
- `config` (object, optional): additional tiler config
- `geozarr_attrs` (object, optional): GeoZarr-spec attributes

### validate_layer_config
Check if a layer configuration is valid before creating a chapter.
**Input**: `dataset_id`, `colormap`, optional `rescale_min`/`rescale_max`

## Ingestion & export

### get_job_status
Get the status of a conversion job by job ID (pending/converting/ready/failed).
**Input**: `job_id` (string)

### ingest_url
Ingest a remote geospatial file (GeoTIFF, GeoJSON, Shapefile `.zip`, NetCDF, HDF5) into a dataset. Waits for conversion to finish and returns the dataset ID.
**Input**: `url` (string); optional `wait` (boolean, default true), `timeout` (number, default 600)

### discover_remote
List geospatial files at a remote URL or S3 prefix before connecting them.
**Input**: `url` (string)

### connect_remote_temporal
Register remote COGs as a temporal (date-stepped, time-slider) or mosaic dataset. Discovers files at the URL if an explicit file list is not given; waits for the job to finish.
**Input**: `url` (string); optional `mode` (`temporal` or `mosaic`, default `temporal`), `files` (array of `{url, filename}`), `timeout` (number)

### upload_story_asset
Upload a local image or CSV file as a story asset (for image chapters and CSV chart chapters). Returns the asset ID and URL.
**Input**: `file_path` (string), `kind` (`image` or `csv`); optional `story_id` (string)

### update_connection_colormap
Set the preferred colormap for a raster connection (cog/xyz_raster/raster pmtiles).
**Input**: `connection_id` (string), `colormap` (string); optional `reversed` (boolean)

### update_connection_categories
Update category labels/colors for a categorical connection.
**Input**: `connection_id` (string), `categories` (array of `{value:int, label?:str, color?:'#RRGGBB'}`)

### delete_connection
Delete an external tile source connection by ID.
**Input**: `connection_id` (string)

### export_story_interactive
Build and download a story's self-contained interactive HTML bundle (`.zip`) to a local path. Stories with zarr layers or scrolly chapters needing snapshots return an error.
**Input**: `story_id` (string), `output_path` (string)

## Resources

- `cng://datasets` — Catalog of available datasets
- `cng://story-templates` — Pre-built templates agents can reference
- `cng://colormaps` — Valid colormap names

## Development

```bash
cd mcp
uv sync --extra dev
uv run pytest tests/ -v
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Troubleshooting

### "Connection refused" on localhost:8086
Verify sandbox stack is running: `docker compose ps`. If not, start it: `docker compose up -d`.

### "Unknown colormap" validation error
List valid colormaps via the `cng://colormaps` resource and pick one.

### Server doesn't discover tools
Run with debug logging: `cng-mcp --log-level DEBUG`. Check for tool registration messages.

### "ModuleNotFoundError: No module named 'cng_mcp'"
Install in editable mode from the `mcp/` directory: `pip install -e mcp/`.
