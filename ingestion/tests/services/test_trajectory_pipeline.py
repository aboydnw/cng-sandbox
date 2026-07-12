import pytest
from src.services import detector
from src.models import FormatPair


def test_detector_accepts_gpx_extension():
    assert detector.detect_format("track.gpx") == FormatPair.GPX_TO_GEOPARQUET
