"""Routes for discovering and connecting remote geospatial data sources."""

import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel as PydanticBaseModel
from pydantic import field_validator

from src.models import Job
from src.rate_limit import limiter
from src.services.discovery import DiscoveryError, fetch_and_discover
from src.services.remote_pipeline import run_remote_pipeline
from src.services.url_validation import SSRFError, validate_url_safe
from src.state import jobs
from src.workspace import get_workspace_id

router = APIRouter(prefix="/api")


class DiscoverRequest(PydanticBaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_safe(cls, v: str) -> str:
        try:
            return validate_url_safe(v, allow_s3=True)
        except SSRFError as exc:
            raise ValueError(str(exc)) from exc


class DiscoverResponse(PydanticBaseModel):
    files: list[dict]
    count: int
    dominant_extension: str


class ConnectRequest(PydanticBaseModel):
    url: str
    mode: str
    files: list[dict]

    @field_validator("url")
    @classmethod
    def validate_url_safe(cls, v: str) -> str:
        try:
            return validate_url_safe(v, allow_s3=True)
        except SSRFError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("files")
    @classmethod
    def validate_file_urls(cls, v: list[dict]) -> list[dict]:
        for f in v:
            file_url = f.get("url", "")
            if file_url:
                try:
                    validate_url_safe(file_url, allow_s3=True)
                except SSRFError as exc:
                    raise ValueError(str(exc)) from exc
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("mosaic", "temporal"):
            raise ValueError("mode must be 'mosaic' or 'temporal'")
        return v


@router.post("/discover", response_model=DiscoverResponse)
@limiter.limit("30/hour")
async def discover(request: Request, body: DiscoverRequest):
    """Discover geospatial files at a URL or S3 prefix."""
    try:
        discovered = await fetch_and_discover(body.url)
    except DiscoveryError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not discovered:
        raise HTTPException(
            status_code=404,
            detail="No supported geospatial files found at this URL",
        )

    files = [{"url": f.url, "filename": f.filename} for f in discovered]
    first_filename = files[0]["filename"]
    dominant_extension = os.path.splitext(first_filename)[1]

    return DiscoverResponse(
        files=files, count=len(files), dominant_extension=dominant_extension
    )


@router.post("/connect-remote")
@limiter.limit("30/hour")
async def connect_remote(
    request: Request,
    body: ConnectRequest,
    background_tasks: BackgroundTasks,
    workspace_id: str = Depends(get_workspace_id),
):
    """Start a remote pipeline job for a set of discovered files."""
    if not body.files:
        raise HTTPException(status_code=400, detail="files must not be empty")

    display_name = f"{len(body.files)} files from {body.url}"
    job = Job(filename=display_name)
    job.workspace_id = workspace_id
    jobs[job.id] = job

    background_tasks.add_task(
        run_remote_pipeline,
        job,
        body.files,
        body.mode,
        request.app.state.db_session_factory,
    )
    return {"job_id": job.id, "dataset_id": job.dataset_id}
