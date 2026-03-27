"""Proxy endpoint for external resources that may not support CORS."""

import logging
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

ALLOWED_EXTENSIONS = (".pmtiles", ".tif", ".tiff")


@router.get("/proxy")
async def proxy_resource(url: str, request: Request):
    decoded = unquote(url)
    if not decoded.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are supported")

    path = decoded.split("?")[0].lower()
    if not any(path.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    headers = {"accept-encoding": "identity"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            resp = await client.get(decoded, headers=headers)
        except httpx.RequestError as e:
            logger.error("Proxy request failed for %s: %s", decoded, e)
            raise HTTPException(status_code=502, detail=str(e)) from e

    if resp.status_code >= 400:
        logger.error("Upstream returned %d for %s", resp.status_code, decoded)
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")

    body = resp.content
    response_headers = {
        "accept-ranges": "bytes",
        "content-length": str(len(body)),
    }
    if "content-type" in resp.headers:
        response_headers["content-type"] = resp.headers["content-type"]
    if "content-range" in resp.headers:
        response_headers["content-range"] = resp.headers["content-range"]

    status = 206 if "content-range" in response_headers else 200
    return Response(
        content=body,
        status_code=status,
        headers=response_headers,
    )
