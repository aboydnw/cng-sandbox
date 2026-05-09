"""Tools for external connections (tile sources)."""

from typing import Any, Optional
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


async def create_connection_tool(
    client: SandboxAPIClient,
    name: str,
    url: str,
    connection_type: str,
    bounds: Optional[list[float]] = None,
    min_zoom: Optional[int] = None,
    max_zoom: Optional[int] = None,
    tile_type: Optional[str] = None,
    band_count: Optional[int] = None,
    rescale: Optional[str] = None,
    config: Optional[dict[str, Any]] = None,
    geozarr_attrs: Optional[dict[str, Any]] = None,
) -> TextContent:
    """Create a new external tile source connection."""
    if not name:
        return TextContent(type="text", text="Error: name is required.")
    conn = await client.create_connection(
        name=name,
        url=url,
        connection_type=connection_type,
        bounds=bounds,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        tile_type=tile_type,
        band_count=band_count,
        rescale=rescale,
        config=config,
        geozarr_attrs=geozarr_attrs,
    )
    conn_id = conn.get("id", "")
    conn_name = conn.get("name", name)
    conn_type = conn.get("connection_type", connection_type)
    conn_url = conn.get("url", url)
    text = f"Connection created.\n\n- **ID**: {conn_id}\n- **Name**: {conn_name}\n- **Type**: {conn_type}\n- **URL**: {conn_url}"
    return TextContent(type="text", text=text)
