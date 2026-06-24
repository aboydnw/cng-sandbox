# Self-host CNG Sandbox and connect via MCP

Run your own single-tenant CNG Sandbox and drive it from an AI client (Claude
Desktop or Claude Code) using the `cng-mcp` server.

> [!WARNING]
> **A self-hosted instance has no authentication.** Access is scoped only by an
> `X-Workspace-Id` request header (any 8 alphanumeric characters). Keep your
> instance on `localhost` or a trusted private network. **Do not expose it to the
> public internet without putting real authentication in front of it.**

## Prerequisites

- Docker and Docker Compose
- A Cloudflare R2 bucket and credentials
- Python 3.11+ (for the `cng-mcp` client)

## 1. Clone and configure

```bash
git clone https://github.com/aboydnw/cng-sandbox.git
cd cng-sandbox
cp .env.example .env   # then edit .env
```

Set the R2 variables in `.env`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`.

## 2. Start the stack

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps   # all services healthy
```

The app is at <http://localhost:5185> and the ingestion API at
<http://localhost:8086>.

## 3. Install the MCP server

```bash
pip install cng-mcp
```

## 4. Connect your AI client

Add to your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`,
or via `claude mcp add`):

```json
{
  "mcpServers": {
    "cng-sandbox": {
      "command": "cng-mcp",
      "args": ["--api-url", "http://localhost:8086", "--workspace-id", "myws0001"]
    }
  }
}
```

`--workspace-id` is any 8-character alphanumeric string; use the same value in the
frontend to see the same data.

## 5. Verify

Ask your AI client to list datasets (the `read_datasets` tool). An empty list (or
the seeded examples) confirms the connection works.
