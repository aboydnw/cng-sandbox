"""Upload route — accepts files and starts the conversion pipeline."""

import ipaddress
import os
import socket
import tempfile
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    UploadFile,
)
from pydantic import BaseModel as PydanticBaseModel
from pydantic import field_validator

from src.config import get_settings
from src.models import Job
from src.services.pipeline import run_pipeline
from src.services.temporal_pipeline import run_temporal_pipeline
from src.state import jobs, scan_store, scan_store_lock
from src.workspace import get_workspace_id

RASTER_EXTENSIONS = {".tif", ".tiff", ".nc", ".nc4", ".h5", ".hdf5"}
TEMPORAL_EXCLUDED = {".h5", ".hdf5"}
MAX_TEMPORAL_FILES = 50


class ConvertUrlRequest(PydanticBaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http and https URLs are supported")
        hostname = parsed.hostname
        if not hostname:
            raise ValueError("URL must include a hostname")
        try:
            addr = ipaddress.ip_address(hostname)
            if addr.is_private or addr.is_loopback or addr.is_reserved:
                raise ValueError("URLs pointing to private networks are not allowed")
        except ValueError as exc:
            if "not allowed" in str(exc):
                raise
            try:
                resolved = socket.getaddrinfo(hostname, None)
                for _, _, _, _, sockaddr in resolved:
                    addr = ipaddress.ip_address(sockaddr[0])
                    if addr.is_private or addr.is_loopback or addr.is_reserved:
                        raise ValueError(
                            "URLs resolving to private networks are not allowed"
                        )
            except socket.gaierror:
                pass
        return v


@asynccontextmanager
async def _save_chunks(suffix: str):
    """Write chunks to a temp file with size validation. Cleans up on error."""
    settings = get_settings()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)  # noqa: SIM115
    size = 0
    try:

        async def write(chunk: bytes):
            nonlocal size
            size += len(chunk)
            if size > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024 * 1024)} MB.",
                )
            tmp.write(chunk)

        yield tmp.name, write
        tmp.close()
    except Exception:
        tmp.close()
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
        raise


router = APIRouter(prefix="/api")


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    workspace_id: str = Depends(get_workspace_id),
):
    """Accept a file upload and start the conversion pipeline."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    ext = os.path.splitext(file.filename)[1]
    async with _save_chunks(suffix=ext) as (tmp_path, write):
        while chunk := await file.read(1024 * 1024):
            await write(chunk)

    job = Job(filename=file.filename)
    job.workspace_id = workspace_id
    jobs[job.id] = job

    background_tasks.add_task(
        _run_and_cleanup, job, tmp_path, request.app.state.db_session_factory
    )
    return {"job_id": job.id, "dataset_id": job.dataset_id}


@router.post("/convert-url")
async def convert_url(
    request: Request,
    body: ConvertUrlRequest,
    background_tasks: BackgroundTasks,
    workspace_id: str = Depends(get_workspace_id),
):
    """Fetch a file from a URL and start the conversion pipeline."""
    parsed = urlparse(body.url)
    filename = os.path.basename(parsed.path) or "download"
    ext = os.path.splitext(filename)[1]

    try:
        async with _save_chunks(suffix=ext) as (tmp_path, write):  # noqa: SIM117
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=300.0
            ) as client:
                async with client.stream("GET", body.url) as resp:
                    resp.raise_for_status()
                    async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                        await write(chunk)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to fetch URL: {e.response.status_code}"
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}") from e

    job = Job(filename=filename)
    job.workspace_id = workspace_id
    jobs[job.id] = job

    background_tasks.add_task(
        _run_and_cleanup, job, tmp_path, request.app.state.db_session_factory
    )
    return {"job_id": job.id, "dataset_id": job.dataset_id}


class ScanConvertRequest(PydanticBaseModel):
    variable: str
    group: str = ""


async def _handle_scan_convert(scan_id: str, variable: str, group: str):
    """Core logic for scan-convert, extracted for testability."""
    async with scan_store_lock:
        entry = scan_store.get(scan_id)
        if entry is None:
            raise HTTPException(
                status_code=404,
                detail="Scan expired or not found. Please re-upload the file.",
            )
        var_names = [v["name"] for v in entry["variables"]]
        if variable not in var_names:
            raise HTTPException(
                status_code=400,
                detail="Variable not found in scan results.",
            )
        job = entry["job"]
        job.variable = variable
        job.group = group
        entry["state"] = "converting"
    job.scan_event.set()


@router.post("/scan/{scan_id}/convert")
async def scan_convert(scan_id: str, body: ScanConvertRequest):
    """Resume a paused pipeline with the selected variable."""
    await _handle_scan_convert(scan_id, body.variable, body.group)
    return {"status": "converting"}


async def _run_and_cleanup(job: Job, input_path: str, db_session_factory):
    """Run the pipeline, then clean up the temp file."""
    try:
        await run_pipeline(job, input_path, db_session_factory)
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)


@router.post("/upload-temporal")
async def upload_temporal(
    request: Request,
    files: list[UploadFile],
    background_tasks: BackgroundTasks,
    workspace_id: str = Depends(get_workspace_id),
):
    """Accept multiple raster files and start the temporal conversion pipeline."""
    if len(files) < 2:
        raise HTTPException(
            status_code=400, detail="Temporal upload requires at least 2 files."
        )
    if len(files) > MAX_TEMPORAL_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_TEMPORAL_FILES} files per temporal upload.",
        )

    extensions = set()
    for f in files:
        if not f.filename:
            raise HTTPException(
                status_code=400, detail="All files must have filenames."
            )
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in RASTER_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Temporal uploads only support raster files. {f.filename} ({ext}) is not supported.",
            )
        if ext in TEMPORAL_EXCLUDED:
            raise HTTPException(
                status_code=400,
                detail="Temporal uploads do not support HDF5 files yet.",
            )
        extensions.add(ext)
    if len(extensions) > 1:
        raise HTTPException(
            status_code=400, detail="All files must be the same format."
        )

    tmp_paths = []
    filenames = []
    try:
        for f in files:
            ext = os.path.splitext(f.filename)[1]
            async with _save_chunks(suffix=ext) as (tmp_path, write):
                while chunk := await f.read(1024 * 1024):
                    await write(chunk)
            tmp_paths.append(tmp_path)
            filenames.append(f.filename)
    except Exception:
        for p in tmp_paths:
            if os.path.exists(p):
                os.unlink(p)
        raise

    job = Job(filename=filenames[0])
    job.workspace_id = workspace_id
    jobs[job.id] = job

    background_tasks.add_task(
        _run_temporal_and_cleanup,
        job,
        tmp_paths,
        filenames,
        request.app.state.db_session_factory,
    )
    return {"job_id": job.id, "dataset_id": job.dataset_id}


async def _run_temporal_and_cleanup(
    job: Job, input_paths: list[str], filenames: list[str], db_session_factory
):
    """Run the temporal pipeline, then clean up all temp files."""
    try:
        await run_temporal_pipeline(job, input_paths, filenames, db_session_factory)
    finally:
        for path in input_paths:
            if os.path.exists(path):
                os.unlink(path)
