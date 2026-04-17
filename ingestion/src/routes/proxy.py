"""Proxy endpoint for external resources that may not support CORS."""

import ipaddress
import logging
import socket
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

ALLOWED_EXTENSIONS = (".pmtiles", ".tif", ".tiff")

MAX_RESPONSE_BYTES = 50 * 1024 * 1024  # 50 MB


def _sanitize_url_for_log(url: str) -> str:
    """Strip query parameters to avoid logging credentials."""
    return url.split("?")[0]


def _is_private_ip(hostname: str) -> bool:
    """Reject requests to private/loopback/link-local addresses (SSRF mitigation)."""
    try:
        for info in socket.getaddrinfo(hostname, None):
            addr = ipaddress.ip_address(info[4][0])
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                return True
    except socket.gaierror:
        return True
    return False


@router.get("/proxy")
async def proxy_resource(url: str, request: Request):
    decoded = unquote(url)
    if not decoded.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are supported")

    parsed = urlparse(decoded)
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")

    if _is_private_ip(parsed.hostname):
        raise HTTPException(status_code=400, detail="Private addresses are not allowed")

    path = decoded.split("?")[0].lower()
    if not any(path.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    headers = {"accept-encoding": "identity"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    safe_url = _sanitize_url_for_log(decoded)

    client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
    try:
        resp = await client.send(
            client.build_request("GET", decoded, headers=headers),
            stream=True,
        )
    except httpx.RequestError as e:
        await client.aclose()
        logger.error("Proxy request failed for %s: %s", safe_url, e)
        raise HTTPException(status_code=502, detail="Upstream request failed") from e

    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        logger.error("Upstream returned %d for %s", resp.status_code, safe_url)
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")

    content_length = resp.headers.get("content-length")
    if content_length and int(content_length) > MAX_RESPONSE_BYTES:
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=413, detail="Response too large")

    response_headers: dict[str, str] = {"accept-ranges": "bytes"}
    if "content-type" in resp.headers:
        response_headers["content-type"] = resp.headers["content-type"]
    if "content-range" in resp.headers:
        response_headers["content-range"] = resp.headers["content-range"]
    if content_length:
        response_headers["content-length"] = content_length

    # If Content-Length is missing, buffer chunks with a size limit
    if not content_length:
        bytes_received = 0
        chunks = []
        try:
            async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                bytes_received += len(chunk)
                if bytes_received > MAX_RESPONSE_BYTES:
                    await resp.aclose()
                    await client.aclose()
                    raise HTTPException(status_code=413, detail="Response too large")
                chunks.append(chunk)
        finally:
            await resp.aclose()
            await client.aclose()

        full_content = b"".join(chunks)
        return StreamingResponse(
            content=[full_content],
            status_code=200,
            headers=response_headers,
        )

    async def stream_and_close():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    status = 206 if "content-range" in response_headers else 200
    return StreamingResponse(
        content=stream_and_close(),
        status_code=status,
        headers=response_headers,
    )
