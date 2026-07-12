from src.models import Dataset, DatasetType, FormatPair


def test_gpx_extension_maps_to_trajectory_format():
    assert FormatPair.from_extension(".gpx") == FormatPair.GPX_TO_GEOPARQUET


def test_gpx_format_dataset_type_is_trajectory():
    assert FormatPair.GPX_TO_GEOPARQUET.dataset_type == DatasetType.TRAJECTORY


def test_dataset_carries_trajectory_fields():
    ds = Dataset(
        id="d1",
        filename="track.gpx",
        dataset_type=DatasetType.TRAJECTORY,
        format_pair=FormatPair.GPX_TO_GEOPARQUET,
        tile_url="/storage/datasets/d1/converted/trips.json",
        trips_url="/storage/datasets/d1/converted/trips.json",
        track_count=2,
        point_count=1234,
        time_start="2024-01-01T00:00:00Z",
        time_end="2024-01-02T00:00:00Z",
        created_at=__import__("datetime").datetime.now(),
    )
    assert ds.trips_url.endswith("trips.json")
    assert ds.track_count == 2
    assert ds.time_start == "2024-01-01T00:00:00Z"
