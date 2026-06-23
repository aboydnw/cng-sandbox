"""Tools for discovering and connecting remote raster mosaics / temporal datasets."""

from typing import Any, Optional

from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools.jobs import poll_job

VALID_MODES = {"temporal", "mosaic"}


async def discover_remote_tool(client: SandboxAPIClient, url: str) -> TextContent:
    """List geospatial files at a URL or S3 prefix."""
    if not url or not url.strip():
        return TextContent(type="text", text="Error: url is required.")
    result = await client.discover(url)
    files = result.get("files", [])
    lines = [f"Found **{result.get('count', len(files))}** files "
             f"(dominant extension `{result.get('dominant_extension', '')}`):", ""]
    for f in files[:50]:
        lines.append(f"- {f.get('filename')} — {f.get('url')}")
    if len(files) > 50:
        lines.append(f"- ...and {len(files) - 50} more")
    return TextContent(type="text", text="\n".join(lines))


async def connect_remote_temporal_tool(
    client: SandboxAPIClient,
    url: str,
    mode: str = "temporal",
    files: Optional[list[dict[str, Any]]] = None,
    timeout: float = 600.0,
) -> TextContent:
    """Register remote COGs as a temporal (date-stepped) or mosaic dataset."""
    if not url or not url.strip():
        return TextContent(type="text", text="Error: url is required.")
    if mode not in VALID_MODES:
        return TextContent(type="text", text="Error: mode must be 'temporal' or 'mosaic'.")

    if files is None:
        discovered = await client.discover(url)
        files = discovered.get("files", [])
    if not files:
        return TextContent(type="text", text="Error: no files to connect.")

    started = await client.connect_remote(url, mode, files)
    job_id = started.get("job_id")
    dataset_id = started.get("dataset_id")
    try:
        job = await poll_job(client, job_id, timeout=timeout)
    except TimeoutError as exc:
        return TextContent(type="text", text=f"Error: {exc}")

    if job.get("status") == "failed":
        return TextContent(
            type="text",
            text=f"Connect failed: {job.get('error', 'unknown error')}",
        )
    return TextContent(
        type="text",
        text=f"{mode.capitalize()} dataset ready from {len(files)} files. "
             f"Dataset: {job.get('dataset_id', dataset_id)} (status ready).",
    )
