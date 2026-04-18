"""Read + parse the fixed 127-byte PMTiles v3 header over HTTP."""

from __future__ import annotations

import struct
from dataclasses import dataclass

import httpx

HEADER_LEN = 127
MAGIC = b"PMTiles"
SUPPORTED_VERSION = 3
TILE_TYPE_MVT = 1

# PMTiles v3 fixed-header byte offsets (see https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md).
TILE_TYPE_OFFSET = 99
MIN_ZOOM_OFFSET = 100
MAX_ZOOM_OFFSET = 101
MIN_LON_E7_OFFSET = 102
MIN_LAT_E7_OFFSET = 106
MAX_LON_E7_OFFSET = 110
MAX_LAT_E7_OFFSET = 114


class PMTilesHeaderError(Exception):
    pass


@dataclass(frozen=True)
class PMTilesHeader:
    version: int
    tile_type: int
    min_zoom: int
    max_zoom: int
    bounds: tuple[float, float, float, float]


def parse_pmtiles_header(buf: bytes) -> PMTilesHeader:
    if len(buf) < HEADER_LEN:
        raise PMTilesHeaderError(
            f"header length {len(buf)} < required {HEADER_LEN}"
        )
    if buf[0:7] != MAGIC:
        raise PMTilesHeaderError("bad magic bytes (not a PMTiles file)")
    version = buf[7]
    if version != SUPPORTED_VERSION:
        raise PMTilesHeaderError(
            f"unsupported PMTiles version {version}; only {SUPPORTED_VERSION} is supported"
        )
    tile_type = buf[TILE_TYPE_OFFSET]
    if tile_type != TILE_TYPE_MVT:
        raise PMTilesHeaderError(
            f"tile_type {tile_type} is not MVT (1); "
            "only vector PMTiles are supported as reference datasets"
        )
    min_zoom = buf[MIN_ZOOM_OFFSET]
    max_zoom = buf[MAX_ZOOM_OFFSET]
    if min_zoom > max_zoom:
        raise PMTilesHeaderError(
            f"min_zoom ({min_zoom}) must be <= max_zoom ({max_zoom})"
        )
    min_lon_e7 = struct.unpack_from("<i", buf, MIN_LON_E7_OFFSET)[0]
    min_lat_e7 = struct.unpack_from("<i", buf, MIN_LAT_E7_OFFSET)[0]
    max_lon_e7 = struct.unpack_from("<i", buf, MAX_LON_E7_OFFSET)[0]
    max_lat_e7 = struct.unpack_from("<i", buf, MAX_LAT_E7_OFFSET)[0]
    bounds = (
        min_lon_e7 / 1e7,
        min_lat_e7 / 1e7,
        max_lon_e7 / 1e7,
        max_lat_e7 / 1e7,
    )
    if not (-180.0 <= bounds[0] <= 180.0 and -180.0 <= bounds[2] <= 180.0):
        raise PMTilesHeaderError(f"longitude bounds out of range: {bounds}")
    if not (-90.0 <= bounds[1] <= 90.0 and -90.0 <= bounds[3] <= 90.0):
        raise PMTilesHeaderError(f"latitude bounds out of range: {bounds}")
    if bounds[0] > bounds[2] or bounds[1] > bounds[3]:
        raise PMTilesHeaderError(f"inverted bounds: {bounds}")
    return PMTilesHeader(
        version=version,
        tile_type=tile_type,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        bounds=bounds,
    )


async def read_pmtiles_header(url: str) -> PMTilesHeader:
    headers = {"Range": f"bytes=0-{HEADER_LEN - 1}"}
    async with (
        httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client,
        client.stream("GET", url, headers=headers) as resp,
    ):
        resp.raise_for_status()
        # Stream-read only the bytes we need. If a server or proxy ignores
        # the Range header, `resp.content` would buffer the entire file
        # into memory (PMTiles archives can be hundreds of GB). Using
        # `aiter_bytes` + an early break caps us at HEADER_LEN bytes
        # regardless of the server's behaviour.
        body = bytearray()
        async for chunk in resp.aiter_bytes():
            remaining = HEADER_LEN - len(body)
            if remaining <= 0:
                break
            body.extend(chunk[:remaining])
            if len(body) >= HEADER_LEN:
                break
    return parse_pmtiles_header(bytes(body))
