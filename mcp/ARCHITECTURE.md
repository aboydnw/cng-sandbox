# CNG MCP Server Architecture

## Overview

```
MCP Client (Claude, agents, CLI)
    ↓ MCP protocol (stdio)
cng_mcp/server.py
    ├─ Tool Handlers
    ├─ Resource Handlers
    └─ Request Router
    ↓ HTTP (httpx)
SandboxAPIClient
    ↓ HTTP
Sandbox Ingestion API (:8086)
    ↓
PostgreSQL, S3, Tilers
```

## Modules

### server.py
MCP server entrypoint. Registers tools/resources. CLI parsing.

### client/sandbox_api.py
Async HTTP wrapper for ingestion API endpoints.

### tools/
Tool implementations. Each takes a client, calls API, returns `TextContent`.

### resources/
Read-only catalogs (datasets, templates, colormaps) as markdown.

## Decision Log

### Separate Package
Thinner boundary, independent versioning, open-source friendly.

### Async/Await
MCP clients may make concurrent requests.

### Static Templates (v1)
Database-backed templates deferred to v2.

### Defer Validation to API
API is single source of truth. MCP does presence checks only.

### Name-Only Colormaps (v1)
Agents pick from list. v2 can expose metadata.

## Error Handling

- Client raises `httpx.HTTPError` on API failures
- Tools catch and format as user-friendly `TextContent`
- Server wraps protocol-level errors
