import pytest
from datetime import datetime, timezone
from src.models import Job, JobStatus, DatasetType, FormatPair, Dataset, Timestep


def test_job_initial_status():
    job = Job(filename="test.tif")
    assert job.status == JobStatus.PENDING
    assert job.dataset_id is not None
    assert len(job.dataset_id) == 36  # UUID


def test_job_status_transitions():
    job = Job(filename="test.tif")
    job.status = JobStatus.SCANNING
    assert job.status == JobStatus.SCANNING
    job.status = JobStatus.READY
    assert job.validation_results == []


def test_format_pair_from_extension():
    assert FormatPair.from_extension(".tif") == FormatPair.GEOTIFF_TO_COG
    assert FormatPair.from_extension(".shp") == FormatPair.SHAPEFILE_TO_GEOPARQUET
    assert FormatPair.from_extension(".geojson") == FormatPair.GEOJSON_TO_GEOPARQUET
    assert FormatPair.from_extension(".nc") == FormatPair.NETCDF_TO_COG


def test_format_pair_unknown_extension():
    with pytest.raises(ValueError):
        FormatPair.from_extension(".xlsx")


def test_format_pair_dataset_type():
    assert FormatPair.GEOTIFF_TO_COG.dataset_type == DatasetType.RASTER
    assert FormatPair.SHAPEFILE_TO_GEOPARQUET.dataset_type == DatasetType.VECTOR
    assert FormatPair.NETCDF_TO_COG.dataset_type == DatasetType.RASTER


def test_dataset_new_fields_default_none():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
    )
    assert d.original_file_size is None
    assert d.converted_file_size is None
    assert d.geoparquet_file_size is None
    assert d.feature_count is None
    assert d.geometry_types is None
    assert d.min_zoom is None
    assert d.max_zoom is None


def test_timestep_model():
    ts = Timestep(datetime="2018-01-01T00:00:00Z", index=0)
    assert ts.datetime == "2018-01-01T00:00:00Z"
    assert ts.index == 0


def test_job_temporal_progress_fields():
    job = Job(filename="test.tif")
    assert job.progress_current is None
    assert job.progress_total is None
    job.progress_current = 3
    job.progress_total = 10
    assert job.progress_current == 3


def test_dataset_temporal_fields_default():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
    )
    assert d.is_temporal is False
    assert d.timesteps == []
    assert d.raster_min is None
    assert d.raster_max is None


def test_dataset_temporal_fields_populated():
    d = Dataset(
        id="x",
        filename="sst",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
        is_temporal=True,
        timesteps=[
            Timestep(datetime="2018-01-01T00:00:00Z", index=0),
            Timestep(datetime="2019-01-01T00:00:00Z", index=1),
        ],
        raster_min=-2.5,
        raster_max=35.0,
    )
    assert d.is_temporal is True
    assert len(d.timesteps) == 2
    assert d.raster_min == -2.5
