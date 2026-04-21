from urllib.parse import urlparse

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.services.url_validation import SSRFError, validate_url_safe

router = APIRouter(prefix="/api", tags=["inspection"])


class InspectUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)


class InspectUrlResponse(BaseModel):
    format: str
    is_cog: bool
    size_bytes: int | None = None
    bounds: list[float] | None = None
    has_errors: bool = False
    error_detail: str | None = None


def _detect_format(url: str) -> tuple[str, bool]:
    if "{z}" in url and ("{x}" in url or "{y}" in url):
        return "xyz", False
    path = urlparse(url).path.lower()
    if path.endswith(".pmtiles"):
        return "pmtiles", False
    if path.endswith(".parquet"):
        return "parquet", False
    if path.endswith(".cog"):
        return "cog", True
    if path.endswith((".tif", ".tiff")):
        return "tiff", False
    if path.endswith(".geojson"):
        return "geojson", False
    return "unknown", False


async def _probe_size(url: str) -> tuple[int | None, str | None]:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            response = await client.head(url)
            if response.is_success:
                content_length = response.headers.get("content-length")
                return (int(content_length) if content_length else None, None)
            return None, f"HTTP {response.status_code}"
    except httpx.TimeoutException:
        return None, "Request timeout"
    except Exception as exc:
        return None, str(exc)


@router.post("/inspect-url", response_model=InspectUrlResponse)
async def inspect_url(request: InspectUrlRequest) -> InspectUrlResponse:
    format_detected, is_cog = _detect_format(request.url)
    size_bytes: int | None = None
    error_detail: str | None = None
    has_errors = False
    if format_detected != "xyz":
        try:
            validate_url_safe(request.url)
        except SSRFError as exc:
            return InspectUrlResponse(
                format=format_detected,
                is_cog=is_cog,
                size_bytes=None,
                bounds=None,
                has_errors=True,
                error_detail=str(exc),
            )
        size_bytes, error_detail = await _probe_size(request.url)
        has_errors = error_detail is not None
    return InspectUrlResponse(
        format=format_detected,
        is_cog=is_cog,
        size_bytes=size_bytes,
        bounds=None,
        has_errors=has_errors,
        error_detail=error_detail,
    )
