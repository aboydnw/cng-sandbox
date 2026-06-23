"""Tool for uploading story chapter assets (images / CSVs)."""

import mimetypes
import os
from typing import Optional

from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient

VALID_KINDS = {"image", "csv"}


async def upload_story_asset_tool(
    client: SandboxAPIClient,
    file_path: str,
    kind: str,
    story_id: Optional[str] = None,
) -> TextContent:
    """Upload a local image or CSV file as a story asset."""
    if kind not in VALID_KINDS:
        return TextContent(type="text", text="Error: kind must be 'image' or 'csv'.")
    if not os.path.isfile(file_path):
        return TextContent(type="text", text=f"Error: file not found: {file_path}")

    try:
        with open(file_path, "rb") as fh:
            file_bytes = fh.read()
    except OSError as exc:
        return TextContent(type="text", text=f"Error reading file {file_path}: {exc}")
    filename = os.path.basename(file_path)
    mime = mimetypes.guess_type(filename)[0] or (
        "text/csv" if kind == "csv" else "application/octet-stream"
    )

    asset = await client.upload_story_asset(
        file_bytes=file_bytes, filename=filename, mime=mime, kind=kind, story_id=story_id
    )
    lines = [
        "Story asset uploaded.",
        f"- **Asset ID**: {asset.get('asset_id')}",
        f"- **URL**: {asset.get('url')}",
    ]
    if asset.get("thumbnail_url"):
        lines.append(f"- **Thumbnail**: {asset.get('thumbnail_url')}")
    return TextContent(type="text", text="\n".join(lines))
