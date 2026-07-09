"""Assemble a byte-stable, cacheable per-story system prompt for the reader agent.

The context body is built from the same reads the exporter uses
(``story_export.build_config``) so the agent's grounding never drifts from what
a reader actually sees. The prompt is deterministic — no timestamps, uuids, or
unsorted dict iteration — so Anthropic prompt caching can reuse the prefix.
"""

import json

from sqlalchemy.orm import Session

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services import story_export, story_utils

_INSTRUCTIONS = """\
# Your role

You are the reader assistant for this data story. Answer questions using ONLY
the story context above and the results of the tools you call. If the story's
data cannot answer a question, say "I don't know from this story's data" — do
not guess or use outside knowledge. Keep answers to one or two sentences.

You may call tools to drive the map or read values. Every tool call is shown to
the reader as a chip, so narrate briefly and let the tool result speak.

# Tools

- fly_to(longitude, latitude, zoom, pitch?, bearing?): move the camera.
- go_to_chapter(chapter_index): scroll the story to a chapter (0-based).
- set_layer_visibility(layer_id, visible): show or hide a layer.
- highlight_location(longitude, latitude, label): drop a temporary pin.
- query_point(longitude, latitude): read raster/zarr values at a point.
- get_area_statistics(bbox): min/max/mean for a [w, s, e, n] box.
- query_features(collection_id?, cql2_filter?): count + sample vector features.
- get_timeseries(longitude, latitude): a compact time series at a point.
"""

_PAD = (
    "Reminder: only answer from this story's data and the tool results. "
    "When unsure, say you don't know from this story's data. "
    "Keep replies short and show your work through tool chips. "
)


def _describe_connection(conn: ConnectionRow) -> list[str]:
    lines: list[str] = []
    if conn.band_count is not None:
        lines.append(f"  - bands: {conn.band_count}")
    if conn.is_categorical and conn.categories_json:
        try:
            cats = json.loads(conn.categories_json)
        except (ValueError, TypeError):
            cats = None
        if isinstance(cats, dict):
            labels = [
                str(v) for _, v in sorted(cats.items(), key=lambda kv: str(kv[0]))
            ]
            lines.append(f"  - categories: {', '.join(labels)}")
        elif isinstance(cats, list):
            lines.append(f"  - categories: {', '.join(str(c) for c in cats)}")
    if conn.rescale:
        lines.append(f"  - rescale: {conn.rescale}")
    if conn.bounds_json:
        lines.append(f"  - bounds: {conn.bounds_json}")
    return lines


def _describe_dataset(ds: DatasetRow) -> list[str]:
    d = ds.to_dict()
    lines: list[str] = []
    band_count = d.get("band_count")
    if band_count is not None:
        lines.append(f"  - bands: {band_count}")
    categories = d.get("categories")
    if isinstance(categories, list) and categories:
        lines.append(f"  - categories: {', '.join(str(c) for c in categories)}")
    if d.get("bounds"):
        lines.append(f"  - bounds: {json.dumps(d['bounds'], sort_keys=True)}")
    temporal = d.get("temporal") or d.get("time_range")
    if temporal:
        lines.append(f"  - temporal: {json.dumps(temporal, sort_keys=True)}")
    return lines


def build_story_context_markdown(story: StoryRow, session: Session) -> str:
    """Human-readable story context: title, chapters, and per-chapter layers."""
    config = story_export.build_config(story, session)
    chapters_raw = story_utils.parse_chapters(story.chapters_json)

    parts: list[str] = []
    parts.append(f"# Story: {config.metadata.title}")
    if config.metadata.description:
        parts.append("")
        parts.append(config.metadata.description)

    parts.append("")
    parts.append("## Chapters")

    for index, chapter in enumerate(config.chapters):
        parts.append("")
        title = chapter.title or "(untitled)"
        parts.append(f"### Chapter {index}: {title}")
        if chapter.body:
            parts.append(chapter.body)

        raw = chapters_raw[index] if index < len(chapters_raw) else {}
        layer_config = raw.get("layer_config") if isinstance(raw, dict) else None
        for layer_id in chapter.layers:
            layer = config.layers.get(layer_id)
            if layer is None:
                continue
            parts.append(f"Layer: {layer.label or '(unnamed)'} ({layer.type})")
            if layer.render.colormap:
                parts.append(f"  - colormap: {layer.render.colormap}")
            if layer.render.rescale:
                lo, hi = layer.render.rescale
                parts.append(f"  - rescale: {lo}, {hi}")
            if isinstance(layer_config, dict):
                connection_id = layer_config.get("connection_id")
                dataset_id = layer_config.get("dataset_id")
                if connection_id:
                    conn = session.get(ConnectionRow, connection_id)
                    if conn is not None:
                        parts.extend(_describe_connection(conn))
                elif dataset_id:
                    ds = session.get(DatasetRow, dataset_id)
                    if ds is not None:
                        parts.extend(_describe_dataset(ds))

    return "\n".join(parts)


# Per-story cache of assembled system blocks. The output is deterministic per
# story, so we key on (id, updated_at) — a publish/update bumps updated_at and
# naturally invalidates the entry. Avoids re-reading the DB and rebuilding the
# prompt on every conversational turn of the same session.
_BLOCK_CACHE: dict[tuple, list[dict]] = {}


def build_system_blocks(
    story: StoryRow, session: Session, *, min_tokens: int = 4096
) -> list[dict]:
    """Build the Anthropic ``system`` array — one cacheable, padded text block."""
    cache_key = (
        story.id,
        story.updated_at.isoformat() if story.updated_at else "",
        min_tokens,
    )
    cached = _BLOCK_CACHE.get(cache_key)
    if cached is not None:
        return cached

    context = build_story_context_markdown(story, session)
    text = f"{context}\n\n{_INSTRUCTIONS}"

    floor = min_tokens * 4  # ~4 chars/token; clears the Haiku 4.5 cache prefix floor
    if len(text) < floor:
        text = text + "\n\n" + _PAD * (((floor - len(text)) // len(_PAD)) + 1)

    blocks = [
        {
            "type": "text",
            "text": text,
            "cache_control": {"type": "ephemeral"},
        }
    ]
    _BLOCK_CACHE[cache_key] = blocks
    return blocks
