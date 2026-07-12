import asyncio
import os

import geopandas as gpd
import pytest

from src.models import Dataset, DatasetType, FormatPair, Job, JobStatus
from src.services import detector
from src.services import trajectory_pipeline as tp

FIXTURE = os.path.join(os.path.dirname(__file__), "..", "fixtures", "two_track.gpx")


def test_detector_accepts_gpx_extension():
    assert detector.detect_format("track.gpx") == FormatPair.GPX_TO_GEOPARQUET


def test_parse_and_write_parquet_has_expected_columns(tmp_path):
    tc = tp.parse_gpx_to_trajectories(FIXTURE)
    out = str(tmp_path / "trips.parquet")
    meta = tp.write_trajectory_parquet(tc, out)

    gdf = gpd.read_parquet(out)
    assert set(["trajectory_id", "timestamp", "geometry", "speed"]).issubset(
        gdf.columns
    )
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


def test_build_trips_json_shape():
    tc = tp.parse_gpx_to_trajectories(FIXTURE)
    trips = tp.build_trips_json(tc)
    assert len(trips) == 2
    first = trips[0]
    assert set(first.keys()) == {"trajectory_id", "path", "timestamps", "speeds"}
    assert len(first["path"]) == len(first["timestamps"]) == len(first["speeds"])
    assert first["path"][0] == pytest.approx(first["path"][0])  # [lng, lat] pairs
    assert isinstance(first["timestamps"][0], (int, float))


def test_over_cap_raises(monkeypatch):
    monkeypatch.setattr(tp, "TRAJECTORY_POINT_CAP", 1)
    tc = tp.parse_gpx_to_trajectories(FIXTURE)
    with pytest.raises(tp.TrajectoryError):
        tp.enforce_point_cap(tc)


def test_run_trajectory_pipeline_persists_dataset(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        tp.StorageService, "upload_raw", lambda self, *a, **k: "raw-key"
    )
    monkeypatch.setattr(
        tp.StorageService, "upload_trajectory_parquet", lambda self, *a, **k: "pq-key"
    )
    monkeypatch.setattr(
        tp.StorageService,
        "upload_trips_json",
        lambda self, *a, **k: "datasets/d1/converted/trips.json",
    )
    monkeypatch.setattr(
        tp, "persist_dataset", lambda factory, ds: captured.setdefault("ds", ds)
    )

    job = Job(
        id="j1", dataset_id="d1", filename="two_track.gpx", status=JobStatus.PENDING
    )
    asyncio.run(tp.run_trajectory_pipeline(job, FIXTURE, db_session_factory=None))

    assert job.status == JobStatus.READY
    ds: Dataset = captured["ds"]
    assert ds.dataset_type == DatasetType.TRAJECTORY
    assert ds.trips_url.endswith("trips.json")
    assert ds.track_count == 2
    assert ds.time_start <= ds.time_end
