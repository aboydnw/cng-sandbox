"""Tests for the GeoParquet → PMTiles conversion service."""
from pathlib import Path

from src.services import geoparquet_to_pmtiles


FIXTURE = Path(__file__).parent / "fixtures" / "tiny.parquet"


def test_convert_local_parquet_to_pmtiles(tmp_path):
    out = tmp_path / "tiny.pmtiles"
    result = geoparquet_to_pmtiles.convert_to_pmtiles(
        source_url=str(FIXTURE),
        output_path=str(out),
    )
    assert out.exists()
    assert out.stat().st_size > 0
    assert result.feature_count == 10
    assert result.min_zoom is not None
    assert result.max_zoom is not None


def test_pmtiles_output_is_readable(tmp_path):
    out = tmp_path / "tiny.pmtiles"
    geoparquet_to_pmtiles.convert_to_pmtiles(
        source_url=str(FIXTURE),
        output_path=str(out),
    )
    # PMTiles v3 header: magic at byte 0, min_zoom at byte 100, max_zoom at byte 101.
    with out.open("rb") as fh:
        header = fh.read(102)
    assert header[:7] == b"PMTiles"
    min_zoom, max_zoom = header[100], header[101]
    assert min_zoom <= max_zoom
