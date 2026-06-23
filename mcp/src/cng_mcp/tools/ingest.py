"""Tool for ingesting remote files via the conversion pipeline."""

from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools.jobs import poll_job


async def ingest_url_tool(
    client: SandboxAPIClient,
    url: str,
    wait: bool = True,
    timeout: float = 600.0,
) -> TextContent:
    """Ingest a remote geospatial file (GeoTIFF, GeoJSON, Shapefile zip, NetCDF, HDF5)."""
    if not url or not url.strip():
        return TextContent(type="text", text="Error: url is required.")

    started = await client.convert_url(url)
    if started.get("detail") == "duplicate_dataset":
        return TextContent(
            type="text",
            text=f"Already ingested. Dataset: {started.get('dataset_id')} "
                 f"(filename {started.get('filename')}).",
        )

    job_id = started.get("job_id")
    dataset_id = started.get("dataset_id")
    if not wait:
        return TextContent(
            type="text",
            text=f"Ingestion started. Job: {job_id}, Dataset (provisional): {dataset_id}.",
        )

    try:
        job = await poll_job(client, job_id, timeout=timeout)
    except TimeoutError as exc:
        return TextContent(type="text", text=f"Error: {exc}")

    if job.get("status") == "failed":
        return TextContent(
            type="text",
            text=f"Ingestion failed for {url}: {job.get('error', 'unknown error')}",
        )
    return TextContent(
        type="text",
        text=f"Ingestion ready. Dataset: {job.get('dataset_id', dataset_id)} (status ready).",
    )
