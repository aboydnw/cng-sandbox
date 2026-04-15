"""Convert a (remote or local) GeoParquet to PMTiles via tippecanoe."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.services.pmtiles_ingest import (
    _read_pmtiles_zoom_range,
    parquet_to_pmtiles_file,
)


@dataclass
class ConversionResult:
    output_path: str
    feature_count: int
    min_zoom: int | None
    max_zoom: int | None
    file_size: int


def convert_to_pmtiles(source_url: str, output_path: str) -> ConversionResult:
    """Download (if remote) and convert a GeoParquet to PMTiles.

    Sync — call via asyncio.to_thread() from async code.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    feature_count = parquet_to_pmtiles_file(source_url, str(out))
    min_zoom, max_zoom = _read_pmtiles_zoom_range(str(out))

    return ConversionResult(
        output_path=str(out),
        feature_count=feature_count,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        file_size=out.stat().st_size,
    )
