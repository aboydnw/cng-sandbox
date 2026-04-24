"""Upload route — accepts files and starts the conversion pipeline."""

import os
import tempfile
from contextlib import asynccontextmanager
from urllib.parse import urlparse

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from pydantic import BaseModel as PydanticBaseModel
from pydantic import field_validator
from starlette.responses import JSONResponse

from src.config import get_settings
from src.models import Job
from src.services.duplicate_check import check_duplicate_filename
from src.services.format_checker import check_format
from src.services.pipeline import run_pipeline
from src.services.temporal_pipeline import run_temporal_pipeline
from src.services.url_validation import SSRFError, raise_if_redirect, validate_url_safe
from src.state import jobs, scan_store, scan_store_lock
from src.workspace import get_workspace_id

RASTER_EXTENSIONS = {".tif", ".tiff", ".nc", ".nc4", ".h5", ".hdf5"}
TEMPORAL_EXCLUDED = {".h5", ".hdf5"}
MAX_TEMPORAL_FILES = 50


def _format_http_error(status_code: int, reason: str) -> str:
    if status_code == 403:
        return "The server returned 403 Forbidden. The file may require authentication."
    if status_code == 404:
        return "File not found at this URL (404)."
    return f"The server returned {status_code} {reason}."


def _format_connection_error(hostname: str) -> str:
    return f"Could not connect to {hostname}. The server may be down or the URL may be incorrect."


def _format_timeout_error(hostname: str) -> str:
    return f"The request to {hostname} timed out. The server may be slow or the file may be too large to fetch."


class ConvertUrlRequest(PydanticBaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        try:
            return validate_url_safe(v)
        except SSRFError as exc:
            raise ValueError(str(exc)) from exc


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


@router.post("/check-format")
async def check_format_endpoint(
    chunk: UploadFile,
    filename: str = Form(default=""),
):
    """Validate a file chunk's format before uploading the full file."""
    max_bytes = 1_048_576
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    ext = os.path.splitext(filename)[1]
    content = await chunk.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail="Format checks are limited to the first 1 MB of the file.",
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        path = tmp.name

    try:
        result = check_format(path, filename)
    finally:
        if os.path.exists(path):
            os.unlink(path)

    return result


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

    session = request.app.state.db_session_factory()
    try:
        existing_id = check_duplicate_filename(session, file.filename, workspace_id)
    finally:
        session.close()
    if existing_id:
        return JSONResponse(
            status_code=409,
            content={
                "detail": "duplicate_dataset",
                "dataset_id": existing_id,
                "filename": file.filename,
            },
        )

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


@router.get("/check-duplicate")
async def check_duplicate(
    filename: str,
    request: Request,
    workspace_id: str = Depends(get_workspace_id),
):
    """Check if a filename already exists in the workspace."""
    session = request.app.state.db_session_factory()
    try:
        existing_id = check_duplicate_filename(session, filename, workspace_id)
    finally:
        session.close()
    if existing_id:
        return JSONResponse(
            status_code=409,
            content={
                "detail": "duplicate_dataset",
                "dataset_id": existing_id,
                "filename": filename,
            },
        )
    return {"duplicate": False}


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

    session = request.app.state.db_session_factory()
    try:
        existing_id = check_duplicate_filename(session, filename, workspace_id)
    finally:
        session.close()
    if existing_id:
        return JSONResponse(
            status_code=409,
            content={
                "detail": "duplicate_dataset",
                "dataset_id": existing_id,
                "filename": filename,
            },
        )

    ext = os.path.splitext(filename)[1]

    try:
        async with _save_chunks(suffix=ext) as (tmp_path, write):  # noqa: SIM117
            async with httpx.AsyncClient(
                follow_redirects=False, timeout=120.0
            ) as client:
                async with client.stream("GET", body.url) as resp:
                    raise_if_redirect(resp)
                    resp.raise_for_status()
                    async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                        await write(chunk)
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except httpx.HTTPStatusError as e:
        msg = _format_http_error(
            e.response.status_code, e.response.reason_phrase or "Unknown"
        )
        raise HTTPException(status_code=400, detail=msg) from e
    except httpx.TimeoutException as e:
        hostname = urlparse(body.url).hostname or "the server"
        raise HTTPException(
            status_code=400, detail=_format_timeout_error(hostname)
        ) from e
    except httpx.RequestError as e:
        hostname = urlparse(body.url).hostname or "the server"
        raise HTTPException(
            status_code=400, detail=_format_connection_error(hostname)
        ) from e

    job = Job(filename=filename)
    job.workspace_id = workspace_id
    jobs[job.id] = job

    background_tasks.add_task(
        _run_and_cleanup, job, tmp_path, request.app.state.db_session_factory
    )
    return {"job_id": job.id, "dataset_id": job.dataset_id}


class TemporalParams(PydanticBaseModel):
    start_index: int
    end_index: int


class ScanConvertRequest(PydanticBaseModel):
    variable: str
    group: str = ""
    temporal: TemporalParams | None = None


async def _handle_scan_convert(
    scan_id: str, variable: str, group: str, temporal: TemporalParams | None = None
):
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

        if temporal is not None:
            max_timesteps = 50
            count = temporal.end_index - temporal.start_index + 1
            if count < 2 or count > max_timesteps:
                raise HTTPException(
                    status_code=400,
                    detail=f"Temporal range must be 2-{max_timesteps} timesteps.",
                )

        job = entry["job"]
        job.variable = variable
        job.group = group
        if temporal is not None:
            entry["temporal"] = temporal
        entry["state"] = "converting"
    job.scan_event.set()


@router.post("/scan/{scan_id}/convert")
async def scan_convert(scan_id: str, body: ScanConvertRequest):
    """Resume a paused pipeline with the selected variable."""
    await _handle_scan_convert(scan_id, body.variable, body.group, body.temporal)
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
