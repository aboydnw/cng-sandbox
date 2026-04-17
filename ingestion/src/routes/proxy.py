"""Proxy endpoint for external resources that may not support CORS."""

import ipaddress
import logging
import socket
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

ALLOWED_EXTENSIONS = (".pmtiles", ".tif", ".tiff")

MAX_RESPONSE_BYTES = 50 * 1024 * 1024  # 50 MB


def _sanitize_url_for_log(url: str) -> str:
    return url.split("?")[0]


def _is_disallowed_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return addr.is_private or addr.is_loopback or addr.is_link_local


def _resolve_to_ip(hostname: str) -> str:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=502, detail="Could not resolve hostname")
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if _is_disallowed_ip(addr):
            raise HTTPException(status_code=400, detail="Private addresses are not allowed")
    return infos[0][4][0]


@router.get("/proxy")
async def proxy_resource(url: str, request: Request):
    decoded = unquote(url)
    if not decoded.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are supported")

    parsed = urlparse(decoded)
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")

    resolved_ip = _resolve_to_ip(parsed.hostname)

    path = decoded.split("?")[0].lower()
    if not any(path.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    headers = {"accept-encoding": "identity"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    safe_url = _sanitize_url_for_log(decoded)

    parsed_scheme = parsed.scheme
    parsed_netloc = parsed.netloc
    hostname = parsed.hostname or ""

    ip_url = decoded.replace(f"{parsed_scheme}://{parsed_netloc}", f"{parsed_scheme}://{resolved_ip}", 1)
    headers["host"] = hostname

    client = httpx.AsyncClient(follow_redirects=False, timeout=30.0)
    try:
        resp = await client.send(
            client.build_request("GET", ip_url, headers=headers),
            stream=True,
            extensions={"sni_hostname": hostname},
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

    if resp.status_code in range(300, 400):
        await resp.aclose()
        await client.aclose()
        logger.warning("Upstream returned redirect %d for %s", resp.status_code, safe_url)
        raise HTTPException(status_code=502, detail="Upstream redirects are not allowed")

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

    # When Content-Length is absent we must buffer to enforce the cap before
    # committing to response headers; raising mid-stream would already have
    # sent a 200 to the client.
    if not content_length:
        bytes_received = 0
        chunks = []
        try:
            async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                bytes_received += len(chunk)
                if bytes_received > MAX_RESPONSE_BYTES:
                    raise HTTPException(status_code=413, detail="Response too large")
                chunks.append(chunk)
        finally:
            await resp.aclose()
            await client.aclose()
        status = 206 if "content-range" in response_headers else 200
        return Response(
            content=b"".join(chunks),
            status_code=status,
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
