"""Pydantic models for jobs and datasets."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    CONVERTING = "converting"
    VALIDATING = "validating"
    INGESTING = "ingesting"
    READY = "ready"
    FAILED = "failed"


class DatasetType(str, Enum):
    RASTER = "raster"
    VECTOR = "vector"


class FormatPair(str, Enum):
    GEOTIFF_TO_COG = "geotiff-to-cog"
    SHAPEFILE_TO_GEOPARQUET = "shapefile-to-geoparquet"
    GEOJSON_TO_GEOPARQUET = "geojson-to-geoparquet"
    NETCDF_TO_COG = "netcdf-to-cog"

    @staticmethod
    def from_extension(ext: str) -> "FormatPair":
        ext = ext.lower()
        mapping = {
            ".tif": FormatPair.GEOTIFF_TO_COG,
            ".tiff": FormatPair.GEOTIFF_TO_COG,
            ".shp": FormatPair.SHAPEFILE_TO_GEOPARQUET,
            ".zip": FormatPair.SHAPEFILE_TO_GEOPARQUET,
            ".geojson": FormatPair.GEOJSON_TO_GEOPARQUET,
            ".json": FormatPair.GEOJSON_TO_GEOPARQUET,
            ".nc": FormatPair.NETCDF_TO_COG,
            ".nc4": FormatPair.NETCDF_TO_COG,
        }
        if ext not in mapping:
            raise ValueError(f"Unsupported format: {ext}")
        return mapping[ext]

    @property
    def dataset_type(self) -> DatasetType:
        if self in (FormatPair.GEOTIFF_TO_COG, FormatPair.NETCDF_TO_COG):
            return DatasetType.RASTER
        return DatasetType.VECTOR


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    detail: str


class Timestep(BaseModel):
    datetime: str  # ISO 8601 UTC
    index: int     # 0-based position in temporal order


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dataset_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    status: JobStatus = JobStatus.PENDING
    format_pair: FormatPair | None = None
    error: str | None = None
    validation_results: list[ValidationCheck] = []
    progress_current: int | None = None
    progress_total: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Dataset(BaseModel):
    id: str
    filename: str
    dataset_type: DatasetType
    format_pair: FormatPair
    tile_url: str
    bounds: list[float] | None = None  # [west, south, east, north]
    band_count: int | None = None  # raster only; None for vector
    band_names: list[str] | None = None        # raster only; from src.descriptions
    color_interpretation: list[str] | None = None  # raster only; from src.colorinterp
    dtype: str | None = None                    # raster only; from src.dtypes[0]
    original_file_size: int | None = None    # bytes, captured before conversion
    converted_file_size: int | None = None   # bytes, output file in MinIO
    geoparquet_file_size: int | None = None  # bytes, GeoParquet before PMTiles conversion
    feature_count: int | None = None         # vector only; None for raster
    geometry_types: list[str] | None = None  # frequency-sorted; None for raster
    min_zoom: int | None = None
    max_zoom: int | None = None
    stac_collection_id: str | None = None
    pg_table: str | None = None
    parquet_url: str | None = None
    validation_results: list[ValidationCheck] = []
    credits: list[dict] = []
    is_temporal: bool = False
    timesteps: list[Timestep] = []
    raster_min: float | None = None
    raster_max: float | None = None
    created_at: datetime
