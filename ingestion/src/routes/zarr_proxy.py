"""Pass-through proxy for zarr stores that block CORS.

Mirrors the security model of /api/proxy: HTTPS-only, blocks private/loopback
IPs at DNS-resolution time, pins the request to the resolved IP literal so a
DNS rebind cannot redirect the connect to an internal host, refuses upstream
3xx responses, and caps the response body size. Differs from /api/proxy in
that there is no file-extension allowlist — zarr stores expose chunks at
arbitrary keys (e.g. "0.0.0", "zarr.json", ".zarray", ".zmetadata").
"""

import asyncio
import ipaddress
import logging
import socket
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from src.rate_limit import limiter
from src.services.url_validation import _is_unsafe_ip

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

MAX_RESPONSE_BYTES = 50 * 1024 * 1024  # 50 MB


def _sanitize_url_for_log(url: str) -> str:
    return url.split("?")[0]


async def _resolve_to_ip(hostname: str) -> str:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(hostname, None)
    except socket.gaierror as err:
        raise HTTPException(
            status_code=502, detail="Could not resolve hostname"
        ) from err
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if _is_unsafe_ip(addr):
            raise HTTPException(
                status_code=400, detail="Private addresses are not allowed"
            )
    return infos[0][4][0]


@router.get("/zarr-proxy")
@limiter.limit("600/hour")
async def zarr_proxy(url: str, request: Request):
    """Stream a single object from a zarr store as a CORS-safe pass-through."""
    decoded = unquote(url)
    if not decoded.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are supported")

    parsed = urlparse(decoded)
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")

    resolved_ip = await _resolve_to_ip(parsed.hostname)

    headers = {"accept-encoding": "identity"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    safe_url = _sanitize_url_for_log(decoded)
    hostname = parsed.hostname
    ip_literal = f"[{resolved_ip}]" if ":" in resolved_ip else resolved_ip
    default_port = 443 if parsed.scheme == "https" else 80
    explicit_port = parsed.port if parsed.port and parsed.port != default_port else None
    port_suffix = f":{explicit_port}" if explicit_port else ""
    ip_url = decoded.replace(
        f"{parsed.scheme}://{parsed.netloc}",
        f"{parsed.scheme}://{ip_literal}{port_suffix}",
        1,
    )
    headers["host"] = f"{hostname}{port_suffix}"

    client = httpx.AsyncClient(follow_redirects=False, timeout=60.0)
    try:
        resp = await client.send(
            httpx.Request(
                "GET", ip_url, headers=headers, extensions={"sni_hostname": hostname}
            ),
            stream=True,
        )
    except httpx.RequestError as e:
        await client.aclose()
        logger.error("Zarr proxy request failed for %s: %s", safe_url, e)
        raise HTTPException(status_code=502, detail="Upstream request failed") from e

    if resp.status_code in range(300, 400):
        await resp.aclose()
        await client.aclose()
        logger.warning(
            "Upstream returned redirect %d for %s", resp.status_code, safe_url
        )
        raise HTTPException(
            status_code=502, detail="Upstream redirects are not allowed"
        )

    if resp.status_code >= 400:
        await resp.aclose()
        await client.aclose()
        logger.error("Upstream returned %d for %s", resp.status_code, safe_url)
        raise HTTPException(status_code=resp.status_code, detail="Upstream error")

    content_length = resp.headers.get("content-length")
    if content_length:
        try:
            parsed_length = int(content_length)
        except ValueError:
            await resp.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=502, detail="Invalid upstream Content-Length"
            )
        if parsed_length > MAX_RESPONSE_BYTES:
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
