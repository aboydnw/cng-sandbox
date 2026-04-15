# CNG MCP Server

Model Context Protocol server for CNG Sandbox. Exposes datasets, stories, connections, and validation as composable tools for agents.

## Installation

```bash
pip install cng-mcp
```

## Usage

```bash
cng-mcp --api-url http://localhost:8086
```

Connect with Claude or any MCP-compatible client.

## Tools

- `read_datasets` — List all datasets in workspace
- `read_story` — Get story metadata and chapters
- `create_story` — Create a new story
- `update_story` — Modify existing story
- `read_connections` — List external tile sources
- `validate_layer_config` — Check if layer config is valid

## Resources

- `cng://datasets` — Available data with metadata
- `cng://story-templates` — Examples agents can reference
- `cng://colormaps` — Valid colormap names

## Development

```bash
cd mcp
uv sync
pytest tests/
```
