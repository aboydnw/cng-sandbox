import struct
from unittest.mock import AsyncMock, patch

import pytest

from src.services.pmtiles_header import (
    PMTilesHeader,
    PMTilesHeaderError,
    parse_pmtiles_header,
    read_pmtiles_header,
)


def _make_header(
    version: int = 3,
    tile_type: int = 1,
    min_zoom: int = 0,
    max_zoom: int = 14,
    min_lon_e7: int = -1_800_000_000,
    min_lat_e7: int = -850_511_287,
    max_lon_e7: int = 1_800_000_000,
    max_lat_e7: int = 850_511_287,
) -> bytes:
    buf = bytearray(127)
    buf[0:7] = b"PMTiles"
    buf[7] = version
    buf[99] = tile_type
    buf[100] = min_zoom
    buf[101] = max_zoom
    struct.pack_into("<i", buf, 102, min_lon_e7)
    struct.pack_into("<i", buf, 106, min_lat_e7)
    struct.pack_into("<i", buf, 110, max_lon_e7)
    struct.pack_into("<i", buf, 114, max_lat_e7)
    return bytes(buf)


def test_parse_valid_header_returns_bounds_and_zoom():
    header_bytes = _make_header()
    parsed = parse_pmtiles_header(header_bytes)
    assert isinstance(parsed, PMTilesHeader)
    assert parsed.min_zoom == 0
    assert parsed.max_zoom == 14
    assert parsed.tile_type == 1
    assert parsed.bounds[0] == pytest.approx(-180.0)
    assert parsed.bounds[1] == pytest.approx(-85.0511287)
    assert parsed.bounds[2] == pytest.approx(180.0)
    assert parsed.bounds[3] == pytest.approx(85.0511287)


def test_parse_rejects_bad_magic():
    bad = bytearray(_make_header())
    bad[0:7] = b"NOPMTFX"
    with pytest.raises(PMTilesHeaderError, match="magic"):
        parse_pmtiles_header(bytes(bad))


def test_parse_rejects_wrong_version():
    with pytest.raises(PMTilesHeaderError, match="version"):
        parse_pmtiles_header(_make_header(version=2))


def test_parse_rejects_non_mvt_tile_type():
    with pytest.raises(PMTilesHeaderError, match="tile_type"):
        parse_pmtiles_header(_make_header(tile_type=2))


def test_parse_rejects_inverted_zoom_range():
    with pytest.raises(PMTilesHeaderError, match="min_zoom"):
        parse_pmtiles_header(_make_header(min_zoom=10, max_zoom=5))


def test_parse_rejects_out_of_range_bounds():
    with pytest.raises(PMTilesHeaderError, match="bounds"):
        parse_pmtiles_header(_make_header(min_lon_e7=-2_000_000_000))


def test_parse_rejects_short_buffer():
    with pytest.raises(PMTilesHeaderError, match="length"):
        parse_pmtiles_header(b"PMTiles" + b"\x00" * 10)


def test_read_pmtiles_header_issues_range_request():
    header_bytes = _make_header()

    async def fake_aenter(self):
        return self

    async def fake_aexit(self, *_args):
        return None

    class FakeResponse:
        status_code = 206
        content = header_bytes

        def raise_for_status(self):
            return None

    instances: list = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.get = AsyncMock(return_value=FakeResponse())
            instances.append(self)

        __aenter__ = fake_aenter
        __aexit__ = fake_aexit

    with patch("src.services.pmtiles_header.httpx.AsyncClient", FakeClient):
        import asyncio
        parsed = asyncio.run(read_pmtiles_header("https://example/x.pmtiles"))

    assert parsed.tile_type == 1
    assert len(instances) == 1
    client = instances[0]
    client.get.assert_awaited_once()
    call_kwargs = client.get.await_args.kwargs
    assert call_kwargs["headers"] == {"Range": "bytes=0-126"}
