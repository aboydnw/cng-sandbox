"""Pydantic models for the portable cng-rc.json story export format.

See specs/2026-04-28-story-portability-design.md for the schema definition.
"""

from typing import Literal

from pydantic import BaseModel


class CngRcOrigin(BaseModel):
    story_id: str
    workspace_id: str | None
    exported_at: str


class CngRcMetadata(BaseModel):
    title: str
    description: str | None
    author: str | None
    created: str
    updated: str


class CngRcMapView(BaseModel):
    center: tuple[float, float]
    zoom: float
    bearing: float = 0.0
    pitch: float = 0.0


class CngRcChapter(BaseModel):
    id: str
    type: Literal["prose", "map", "scrollytelling", "image", "video", "chart"]
    title: str | None
    body: str | None
    map: CngRcMapView | None
    layers: list[str]
    extra: dict | None = None


class CngRcRender(BaseModel):
    colormap: str | None
    rescale: tuple[float, float] | None
    opacity: float
    band: int | None
    timestep: str | None


class CngRcLayer(BaseModel):
    type: Literal["raster-cog", "vector-geoparquet", "pmtiles", "xyz"]
    source_url: str | None
    cng_url: str | None
    label: str | None
    attribution: str | None
    render: CngRcRender


class CngRcAsset(BaseModel):
    kind: Literal["image", "video", "video-thumbnail"]
    url: str
    mime: str | None


class CngRcConfig(BaseModel):
    version: Literal["1"] = "1"
    origin: CngRcOrigin
    metadata: CngRcMetadata
    chapters: list[CngRcChapter]
    layers: dict[str, CngRcLayer]
    assets: dict[str, CngRcAsset]
