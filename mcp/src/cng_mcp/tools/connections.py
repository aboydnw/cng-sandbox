"""Tools for external connections (tile sources)."""

from mcp.types import TextContent
from cng_mcp.client.sandbox_api import SandboxAPIClient


async def read_connections_tool(client: SandboxAPIClient) -> TextContent:
    """List all external tile source connections."""
    connections = await client.get_connections()
    if not connections:
        return TextContent(type="text", text="No external connections configured.")

    lines = ["# External Tile Sources\n"]
    for conn in connections:
        conn_id = conn.get("id", "")
        name = conn.get("name", "")
        url = conn.get("url", "")
        conn_type = conn.get("connection_type", "")
        is_cat = conn.get("is_categorical", False)

        lines.append(f"## {name}")
        lines.append(f"- **ID**: {conn_id}")
        lines.append(f"- **Type**: {conn_type}")
        lines.append(f"- **URL**: {url}")
        if is_cat:
            categories = conn.get("categories", []) or []
            lines.append(f"- **Categorical**: Yes ({len(categories)} categories)")
        else:
            lines.append(f"- **Categorical**: No")
        lines.append("")
    return TextContent(type="text", text="\n".join(lines))
