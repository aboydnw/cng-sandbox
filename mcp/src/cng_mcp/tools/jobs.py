"""Tools for conversion jobs."""

import asyncio
import time
from typing import Any, Callable

from mcp.types import TextContent

from cng_mcp.client.sandbox_api import SandboxAPIClient

TERMINAL_STATES = {"ready", "failed"}


async def poll_job(
    client: SandboxAPIClient,
    job_id: str,
    *,
    interval: float = 2.0,
    timeout: float = 600.0,
    sleep: Callable = asyncio.sleep,
    _now: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """Poll a job until it reaches a terminal state. Raises TimeoutError on timeout."""
    start = _now()
    while True:
        job = await client.get_job(job_id)
        if job.get("status") in TERMINAL_STATES:
            return job
        if _now() - start >= timeout:
            raise TimeoutError(f"Job {job_id} did not finish within {timeout}s")
        await sleep(interval)


async def get_job_status_tool(client: SandboxAPIClient, job_id: str) -> TextContent:
    """Report the current status of a conversion job."""
    if not job_id or not job_id.strip():
        return TextContent(type="text", text="Error: job_id is required.")
    job = await client.get_job(job_id)
    status = job.get("status", "unknown")
    lines = [f"Job `{job_id}` status: **{status}**"]
    if job.get("dataset_id"):
        lines.append(f"- Dataset: {job['dataset_id']}")
    if job.get("error"):
        lines.append(f"- Error: {job['error']}")
    return TextContent(type="text", text="\n".join(lines))
