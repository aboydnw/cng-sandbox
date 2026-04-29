"""Serialize a StoryRow to a portable CngRcConfig payload."""

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from src.models.cng_rc import (
    CngRcAsset,
    CngRcChapter,
    CngRcConfig,
    CngRcLayer,
    CngRcMapView,
    CngRcMetadata,
    CngRcOrigin,
    CngRcRender,
)
from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow

_CONNECTION_TYPE_MAP = {
    "cog": "raster-cog",
    "geoparquet": "vector-geoparquet",
    "pmtiles": "pmtiles",
    "xyz_raster": "xyz",
    "xyz_vector": "xyz",
    "zarr": "zarr",
}


def build_config(story: StoryRow, session: Session) -> CngRcConfig:
    """Build a portable CngRcConfig from a StoryRow."""
    chapters_raw = json.loads(story.chapters_json) if story.chapters_json else []

    layers: dict[str, CngRcLayer] = {}
    assets: dict[str, CngRcAsset] = {}
    out_chapters: list[CngRcChapter] = []

    for ch in chapters_raw:
        chapter_layer_ids: list[str] = []
        layer_config = ch.get("layer_config")
        if layer_config:
            layer_id = str(uuid4())
            layer = _resolve_layer(layer_config, session)
            if layer is not None:
                layers[layer_id] = layer
                chapter_layer_ids.append(layer_id)

        out_chapters.append(
            CngRcChapter(
                id=ch.get("id") or str(uuid4()),
                type=ch.get("type", "prose"),
                title=ch.get("title"),
                body=ch.get("body") or ch.get("narrative"),
                map=_resolve_map_view(ch.get("map_state")),
                layers=chapter_layer_ids,
                extra=_extract_chapter_extra(ch),
            )
        )

    return CngRcConfig(
        version="1",
        origin=CngRcOrigin(
            story_id=story.id,
            workspace_id=story.workspace_id,
            exported_at=datetime.now(UTC).isoformat(),
        ),
        metadata=CngRcMetadata(
            title=story.title,
            description=story.description,
            author=None,
            created=story.created_at.isoformat(),
            updated=story.updated_at.isoformat(),
        ),
        chapters=out_chapters,
        layers=layers,
        assets=assets,
    )


def _resolve_map_view(map_state: dict | None) -> CngRcMapView | None:
    if not map_state:
        return None
    center = map_state.get("center")
    if not center or len(center) != 2:
        return None
    return CngRcMapView(
        center=(center[0], center[1]),
        zoom=map_state.get("zoom", 0),
        bearing=map_state.get("bearing", 0),
        pitch=map_state.get("pitch", 0),
    )


def _resolve_layer(lc: dict, session: Session) -> CngRcLayer | None:
    connection_id = lc.get("connection_id")
    dataset_id = lc.get("dataset_id")
    rescale_min = lc.get("rescale_min")
    rescale_max = lc.get("rescale_max")
    render = CngRcRender(
        colormap=lc.get("colormap"),
        rescale=(rescale_min, rescale_max)
        if rescale_min is not None and rescale_max is not None
        else None,
        opacity=lc.get("opacity", 1.0),
        band=lc.get("band"),
        timestep=lc.get("timestep"),
    )

    if connection_id:
        conn = session.get(ConnectionRow, connection_id)
        if conn is None:
            return None
        return CngRcLayer(
            type=_CONNECTION_TYPE_MAP.get(conn.connection_type, "raster-cog"),
            source_url=conn.url,
            cng_url=None,
            label=conn.name,
            attribution=None,
            render=render,
        )

    if dataset_id:
        ds = session.get(DatasetRow, dataset_id)
        if ds is None:
            return None
        ds_dict = ds.to_dict()
        cng_url = ds_dict.get("cog_url") or ds_dict.get("parquet_url")
        layer_type = "vector-geoparquet" if ds_dict.get("parquet_url") else "raster-cog"
        return CngRcLayer(
            type=layer_type,
            source_url=ds_dict.get("source_url"),
            cng_url=cng_url,
            label=ds_dict.get("title") or ds.filename,
            attribution=None,
            render=render,
        )

    return None


def _extract_chapter_extra(ch: dict) -> dict | None:
    """Extract type-specific nested payload (image/video/chart) for export."""
    nested_key = {
        "image": "image",
        "video": "video",
        "chart": "chart",
    }.get(ch.get("type"))
    if not nested_key:
        return None
    payload = ch.get(nested_key)
    if not isinstance(payload, dict) or not payload:
        return None
    return {nested_key: payload}
