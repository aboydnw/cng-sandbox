# CNG MCP Server

Model Context Protocol (MCP) server for CNG Sandbox. Exposes datasets, stories, connections, and validation as composable tools for agents.

## What is MCP?

MCP is a protocol that lets applications (agents, CLI tools, SDKs) discover and interact with tools and resources in a standardized way. This server makes the CNG Sandbox accessible to any MCP-compatible client.

## Installation

```bash
pip install cng-mcp
```

## Quick Start

### 1. Start the Server

```bash
# Default API URL (http://localhost:8086)
cng-mcp

# Custom API URL
cng-mcp --api-url http://your-sandbox.com
```

The server communicates over stdio. Connect with any MCP client.

### 2. Use with Claude Desktop / Code

Add to your MCP client config:

```json
{
  "mcpServers": {
    "cng-sandbox": {
      "command": "cng-mcp",
      "args": ["--api-url", "http://localhost:8086"]
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
- `chapters` (array): each with `title`, `text`, `dataset_id`, `map_state`, `layer_config`

### update_story
Modify an existing story.
**Input**: `story_id`, `updates` (object with changed fields)

### read_connections
List external tile source connections.

### validate_layer_config
Check if a layer configuration is valid before creating a chapter.
**Input**: `dataset_id`, `colormap`, optional `rescale_min`/`rescale_max`

## Resources

- `cng://datasets` — Catalog of available datasets
- `cng://story-templates` — Pre-built templates agents can reference
- `cng://colormaps` — Valid colormap names

## Development

```bash
cd mcp
uv sync
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
