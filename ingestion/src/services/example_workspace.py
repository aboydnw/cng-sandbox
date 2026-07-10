"""Seed and remove per-workspace copies of example data.

Master rows (``is_example=True``) are cloned into a workspace as editable
copies (``is_example_copy=True``). Cloning is metadata-only: copies reuse the
master's ``tile_url``/``source_url``/``metadata_json``, so no pgSTAC or R2 work
happens and deleting a copy never tears down shared storage.
"""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from src.models import workspace_example_state as wes
from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow


def _clone_dataset(row: DatasetRow, workspace_id: str) -> DatasetRow:
    return DatasetRow(
        id=str(uuid.uuid4()),
        filename=row.filename,
        dataset_type=row.dataset_type,
        format_pair=row.format_pair,
        tile_url=row.tile_url,
        bounds_json=row.bounds_json,
        metadata_json=row.metadata_json,
        created_at=datetime.now(UTC),
        workspace_id=workspace_id,
        expires_at=None,
        is_example=False,
        is_example_copy=True,
        seeded_from_id=row.id,
        is_shared=False,
        render_mode=row.render_mode,
        preferred_colormap=row.preferred_colormap,
        preferred_colormap_reversed=row.preferred_colormap_reversed,
    )


def _clone_connection(row: ConnectionRow, workspace_id: str) -> ConnectionRow:
    return ConnectionRow(
        id=str(uuid.uuid4()),
        name=row.name,
        url=row.url,
        connection_type=row.connection_type,
        bounds_json=row.bounds_json,
        min_zoom=row.min_zoom,
        max_zoom=row.max_zoom,
        tile_type=row.tile_type,
        band_count=row.band_count,
        rescale=row.rescale,
        workspace_id=workspace_id,
        is_categorical=row.is_categorical,
        categories_json=row.categories_json,
        created_at=datetime.now(UTC),
        tile_url=row.tile_url,
        render_path=row.render_path,
        conversion_status=row.conversion_status,
        conversion_error=row.conversion_error,
        feature_count=row.feature_count,
        file_size=row.file_size,
        is_shared=False,
        is_example=False,
        is_example_copy=True,
        seeded_from_id=row.id,
        render_mode=row.render_mode,
        preferred_colormap=row.preferred_colormap,
        preferred_colormap_reversed=row.preferred_colormap_reversed,
        config=row.config,
        geozarr_attrs=row.geozarr_attrs,
    )


def _remap_chapter_refs(
    chapters: list, dataset_map: dict, connection_map: dict
) -> list:
    """Rewrite dataset/connection ids inside a story's chapters using the maps."""
    for ch in chapters:
        layer = ch.get("layer_config")
        if isinstance(layer, dict):
            ds_id = layer.get("dataset_id")
            if ds_id in dataset_map:
                layer["dataset_id"] = dataset_map[ds_id]
            conn_id = layer.get("connection_id")
            if conn_id in connection_map:
                layer["connection_id"] = connection_map[conn_id]
        chart = ch.get("chart")
        if isinstance(chart, dict):
            source = chart.get("source")
            if isinstance(source, dict):
                src_ds = source.get("dataset_id")
                if src_ds in dataset_map:
                    source["dataset_id"] = dataset_map[src_ds]
    return chapters


def _clone_story(
    row: StoryRow, workspace_id: str, dataset_map: dict, connection_map: dict
) -> StoryRow:
    chapters = json.loads(row.chapters_json) if row.chapters_json else []
    chapters = _remap_chapter_refs(chapters, dataset_map, connection_map)
    now = datetime.now(UTC)
    return StoryRow(
        id=str(uuid.uuid4()),
        title=row.title,
        description=row.description,
        dataset_id=dataset_map.get(row.dataset_id, row.dataset_id),
        chapters_json=json.dumps(chapters),
        published=False,
        is_example=False,
        is_example_copy=True,
        seeded_from_id=row.id,
        created_at=now,
        updated_at=now,
        workspace_id=workspace_id,
    )


def _delete_copies(session: Session, workspace_id: str) -> int:
    deleted = 0
    for model in (StoryRow, ConnectionRow, DatasetRow):
        rows = (
            session.query(model)
            .filter(
                model.workspace_id == workspace_id,
                model.is_example_copy.is_(True),
            )
            .all()
        )
        for row in rows:
            session.delete(row)
            deleted += 1
    return deleted


def seed_workspace_examples(session: Session, workspace_id: str) -> dict:
    """Clean-slate clone of all master examples into ``workspace_id``.

    Returns ``{"story_id_map": {master_story_id: clone_id}}``.
    """
    _delete_copies(session, workspace_id)

    dataset_map: dict[str, str] = {}
    for master in session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)):
        clone = _clone_dataset(master, workspace_id)
        session.add(clone)
        dataset_map[master.id] = clone.id

    connection_map: dict[str, str] = {}
    for master in session.query(ConnectionRow).filter(
        ConnectionRow.is_example.is_(True)
    ):
        clone = _clone_connection(master, workspace_id)
        session.add(clone)
        connection_map[master.id] = clone.id

    story_id_map: dict[str, str] = {}
    for master in session.query(StoryRow).filter(StoryRow.is_example.is_(True)):
        clone = _clone_story(master, workspace_id, dataset_map, connection_map)
        session.add(clone)
        story_id_map[master.id] = clone.id

    session.commit()
    wes.set_state(session, workspace_id, "seeded")
    return {"story_id_map": story_id_map}


def remove_workspace_examples(session: Session, workspace_id: str) -> int:
    """Delete every ``is_example_copy`` row for the workspace. Returns count."""
    deleted = _delete_copies(session, workspace_id)
    session.commit()
    wes.set_state(session, workspace_id, "removed")
    return deleted
