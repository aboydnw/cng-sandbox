import os

import geopandas as gpd
import pytest
from src.services import detector
from src.services import trajectory_pipeline as tp
from src.models import FormatPair

FIXTURE = os.path.join(os.path.dirname(__file__), "..", "fixtures", "two_track.gpx")


def test_detector_accepts_gpx_extension():
    assert detector.detect_format("track.gpx") == FormatPair.GPX_TO_GEOPARQUET


def test_parse_and_write_parquet_has_expected_columns(tmp_path):
    tc = tp.parse_gpx_to_trajectories(FIXTURE)
    out = str(tmp_path / "trips.parquet")
    meta = tp.write_trajectory_parquet(tc, out)

    gdf = gpd.read_parquet(out)
    assert set(["trajectory_id", "timestamp", "geometry", "speed"]).issubset(gdf.columns)
    assert meta["track_count"] == 2
    assert meta["point_count"] == len(gdf)
    assert meta["time_start"] <= meta["time_end"]
    assert len(meta["bounds"]) == 4


def test_parse_rejects_gpx_without_timestamps(tmp_path):
    no_time = tmp_path / "notime.gpx"
    no_time.write_text(
        '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>'
        '<trkpt lat="1.0" lon="2.0"></trkpt>'
        '<trkpt lat="1.1" lon="2.1"></trkpt>'
        "</trkseg></trk></gpx>"
    )
    with pytest.raises(tp.TrajectoryError):
        tp.parse_gpx_to_trajectories(str(no_time))
