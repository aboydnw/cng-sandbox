"""Tool for exporting a story as an interactive HTML bundle."""

import httpx
from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient


async def export_story_interactive_tool(
    client: SandboxAPIClient,
    story_id: str,
    output_path: str,
) -> TextContent:
    """Export a story to a self-contained interactive HTML .zip bundle."""
    if not story_id or not story_id.strip():
        return TextContent(type="text", text="Error: story_id is required.")
    try:
        data = await client.export_story_interactive(story_id)
    except httpx.HTTPStatusError as exc:
        detail = ""
        try:
            detail = exc.response.json().get("detail", "")
        except Exception:
            detail = exc.response.text
        return TextContent(type="text", text=f"Error exporting story {story_id}: {detail}")

    with open(output_path, "wb") as fh:
        fh.write(data)
    return TextContent(
        type="text",
        text=f"Interactive bundle written to {output_path} ({len(data)} bytes).",
    )
