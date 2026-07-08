import asyncio
import io
import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from src.rate_limit import limiter
from src.services.cog_checker import check_remote_is_cog
from src.services.pointcloud_geo import wgs84_bounds
from src.services.url_validation import SSRFError, raise_if_redirect, validate_url_safe

LAS_HEADER_PROBE_BYTES = 65535

router = APIRouter(prefix="/api", tags=["inspection"])

logger = logging.getLogger(__name__)

COG_PROBE_TIMEOUT_SECONDS = 10.0


class InspectUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)


class InspectUrlResponse(BaseModel):
    format: str
    is_cog: bool
    size_bytes: int | None = None
    bounds: list[float] | None = None
    crs: str | None = None
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
    if path.endswith(".laz"):
        return "copc", False
    if path.endswith(".cog"):
        return "cog", True
    if path.endswith((".tif", ".tiff")):
        return "tiff", False
    if path.endswith(".geojson"):
        return "geojson", False
    return "unknown", False


def _probe_las_over_http(url: str) -> tuple[list[float] | None, str | None]:
    """Range-read a LAS/LAZ/COPC header and return (WGS84 bounds, CRS).

    Reads only the header region (VLRs, not the trailing EVLRs), so it works on
    large remote COPC files without downloading the point data.
    """
    import laspy

    try:
        with httpx.Client(follow_redirects=False, timeout=10.0) as client:
            response = client.get(
                url, headers={"Range": f"bytes=0-{LAS_HEADER_PROBE_BYTES}"}
            )
            raise_if_redirect(response)
            if not response.is_success:
                return None, None
        header = laspy.LasHeader.read_from(
            io.BytesIO(response.content), read_evlrs=False
        )
        crs_obj = header.parse_crs()
        if crs_obj is None:
            return None, None
        epsg = crs_obj.to_epsg()
        crs = f"EPSG:{epsg}" if epsg else crs_obj.name
        native = [header.x_min, header.y_min, header.x_max, header.y_max]
        return wgs84_bounds(native, crs_obj.to_wkt()), crs
    except Exception as exc:
        logger.info("LAS probe failed for %s: %s", urlparse(url).path, exc)
        return None, None


async def _probe_size(url: str) -> tuple[int | None, str | None]:
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=5.0) as client:
            response = await client.head(url)
            raise_if_redirect(response)
            if response.is_success:
                content_length = response.headers.get("content-length")
                return (int(content_length) if content_length else None, None)
            return None, f"HTTP {response.status_code}"
    except httpx.TimeoutException:
        return None, "Request timeout"
    except SSRFError as exc:
        return None, str(exc)
    except Exception as exc:
        return None, str(exc)


async def _probe_is_cog(url: str) -> bool:
    try:
        result = await asyncio.wait_for(
            check_remote_is_cog(url), timeout=COG_PROBE_TIMEOUT_SECONDS
        )
        return result.is_cog
    except Exception as exc:
        safe_url = urlparse(url)._replace(query="", fragment="").geturl()
        logger.info("COG probe failed for %s: %s", safe_url, exc)
        return False


@router.post("/inspect-url", response_model=InspectUrlResponse)
@limiter.limit("120/hour")
async def inspect_url(request: Request, body: InspectUrlRequest) -> InspectUrlResponse:
    format_detected, is_cog = _detect_format(body.url)
    size_bytes: int | None = None
    error_detail: str | None = None
    has_errors = False
    bounds: list[float] | None = None
    crs: str | None = None
    if format_detected != "xyz":
        try:
            validate_url_safe(body.url)
        except SSRFError as exc:
            return InspectUrlResponse(
                format=format_detected,
                is_cog=is_cog,
                size_bytes=None,
                bounds=None,
                has_errors=True,
                error_detail=str(exc),
            )
        size_bytes, error_detail = await _probe_size(body.url)
        has_errors = error_detail is not None
        if format_detected == "tiff" and not has_errors:
            is_cog = await _probe_is_cog(body.url)
        if format_detected == "copc":
            bounds, crs = await asyncio.to_thread(_probe_las_over_http, body.url)
    return InspectUrlResponse(
        format=format_detected,
        is_cog=is_cog,
        size_bytes=size_bytes,
        bounds=bounds,
        crs=crs,
        has_errors=has_errors,
        error_detail=error_detail,
    )
