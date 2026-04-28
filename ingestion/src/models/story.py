"""Story persistence model and API schemas."""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, String, Text

from src.models.base import Base


class StoryRow(Base):
    __tablename__ = "stories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="Untitled story")
    description = Column(String, nullable=True)
    dataset_id = Column(String, nullable=True)
    chapters_json = Column(Text, nullable=False, default="[]")
    published = Column(Boolean, nullable=False, default=False)
    is_example = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    workspace_id = Column(String, nullable=True)


class MapStatePayload(BaseModel):
    center: tuple[float, float]
    zoom: float
    bearing: float
    pitch: float
    basemap: str


class LayerConfigPayload(BaseModel):
    dataset_id: str
    connection_id: str | None = None
    colormap: str
    opacity: float
    basemap: str
    band: int | None = None
    timestep: int | None = None
    rescale_min: float | None = None
    rescale_max: float | None = None
    colormap_reversed: bool | None = None


class _BaseChapter(BaseModel):
    id: str
    order: int
    title: str
    narrative: str


class ScrollytellingChapter(_BaseChapter):
    type: Literal["scrollytelling"] = "scrollytelling"
    map_state: MapStatePayload
    layer_config: LayerConfigPayload
    transition: Literal["fly-to", "instant"] = "fly-to"
    overlay_position: Literal["left", "right"] = "left"


class MapChapter(_BaseChapter):
    type: Literal["map"]
    map_state: MapStatePayload
    layer_config: LayerConfigPayload


class ProseChapter(_BaseChapter):
    type: Literal["prose"]


class ImageAssetPayload(BaseModel):
    asset_id: str
    url: str
    thumbnail_url: str
    alt_text: str
    width: int = Field(ge=0)
    height: int = Field(ge=0)


class ImageChapter(_BaseChapter):
    type: Literal["image"]
    image: ImageAssetPayload


class VideoEmbedPayload(BaseModel):
    provider: Literal["youtube", "vimeo"]
    video_id: str
    original_url: str


class VideoChapter(_BaseChapter):
    type: Literal["video"]
    video: VideoEmbedPayload


class CsvSourcePayload(BaseModel):
    kind: Literal["csv"]
    asset_id: str
    url: str
    columns: list[str]


class DatasetTimeseriesSourcePayload(BaseModel):
    kind: Literal["dataset_timeseries"]
    dataset_id: str
    point: tuple[float, float]


class DatasetHistogramSourcePayload(BaseModel):
    kind: Literal["dataset_histogram"]
    dataset_id: str
    bins: int | None = Field(default=None, ge=2, le=100)


ChartSourcePayload = Annotated[
    CsvSourcePayload | DatasetTimeseriesSourcePayload | DatasetHistogramSourcePayload,
    Field(discriminator="kind"),
]


class ChartVizPayload(BaseModel):
    kind: Literal["line", "bar"]
    x_field: str
    y_fields: list[str]
    x_label: str | None = None
    y_label: str | None = None
    y_scale: Literal["linear", "log"] | None = None


class ChartPayload(BaseModel):
    source: ChartSourcePayload
    viz: ChartVizPayload


class ChartChapter(_BaseChapter):
    type: Literal["chart"]
    chart: ChartPayload


ChapterPayload = Annotated[
    ScrollytellingChapter
    | MapChapter
    | ProseChapter
    | ImageChapter
    | VideoChapter
    | ChartChapter,
    Field(discriminator="type"),
]


class StoryCreate(BaseModel):
    title: str = "Untitled story"
    description: str | None = None
    dataset_id: str | None = None
    chapters: list[ChapterPayload] = []
    published: bool = False


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    chapters: list[ChapterPayload] | None = None
    published: bool | None = None


class StoryResponse(BaseModel):
    id: str
    title: str
    description: str | None
    dataset_id: str | None
    dataset_ids: list[str]
    chapters: list[ChapterPayload]
    published: bool
    is_example: bool = False
    created_at: str
    updated_at: str
