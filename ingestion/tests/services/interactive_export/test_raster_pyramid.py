from pathlib import Path

import pytest
from pmtiles.reader import MmapSource, Reader

from src.services.interactive_export import raster_pyramid

FIXTURE_COG = Path(__file__).parent / "fixtures" / "small_cog.tif"


def test_pyramid_writes_pmtiles_file(tmp_path):
    output = tmp_path / "raster.pmtiles"
    raster_pyramid.build_pyramid(
        source_url=str(FIXTURE_COG),
        bbox=(-5.0, -5.0, 5.0, 5.0),
        min_zoom=0,
        max_zoom=2,
        output_path=output,
    )
    assert output.exists()
    assert output.stat().st_size > 0


def test_pyramid_contains_expected_zoom_range(tmp_path):
    output = tmp_path / "raster.pmtiles"
    raster_pyramid.build_pyramid(
        source_url=str(FIXTURE_COG),
        bbox=(-5.0, -5.0, 5.0, 5.0),
        min_zoom=0,
        max_zoom=2,
        output_path=output,
    )
    with open(output, "rb") as f:
        reader = Reader(MmapSource(f))
        header = reader.header()
        assert header["min_zoom"] == 0
        assert header["max_zoom"] == 2


def test_pyramid_raises_when_bbox_outside_source(tmp_path):
    output = tmp_path / "raster.pmtiles"
    with pytest.raises(ValueError, match="bbox does not intersect"):
        raster_pyramid.build_pyramid(
            source_url=str(FIXTURE_COG),
            bbox=(100.0, 100.0, 110.0, 110.0),
            min_zoom=0,
            max_zoom=2,
            output_path=output,
        )
