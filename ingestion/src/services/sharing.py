"""Read-policy helpers for datasets and connections."""

import json

from sqlalchemy.orm import Session

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow


def _parse_chapters(raw: str | None) -> list:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(parsed, list):
        return []
    return parsed


def is_dataset_referenced_by_published_story(session: Session, dataset_id: str) -> bool:
    """True if any published story references the given dataset."""
    rows = session.query(StoryRow).filter(StoryRow.published.is_(True)).all()
    for row in rows:
        if row.dataset_id == dataset_id:
            return True
        chapters = _parse_chapters(row.chapters_json)
        for ch in chapters:
            if not isinstance(ch, dict):
                continue
            lc = ch.get("layer_config") or {}
            if isinstance(lc, dict) and lc.get("dataset_id") == dataset_id:
                return True
    return False


def is_connection_referenced_by_published_story(
    session: Session, connection_id: str
) -> bool:
    """True if any published story references the given connection."""
    rows = session.query(StoryRow).filter(StoryRow.published.is_(True)).all()
    for row in rows:
        chapters = _parse_chapters(row.chapters_json)
        for ch in chapters:
            if not isinstance(ch, dict):
                continue
            lc = ch.get("layer_config") or {}
            if isinstance(lc, dict) and lc.get("connection_id") == connection_id:
                return True
    return False


def can_read_dataset(session: Session, row: DatasetRow, workspace_id: str) -> bool:
    """Apply the public read policy to a dataset row."""
    if row.workspace_id and workspace_id and row.workspace_id == workspace_id:
        return True
    if row.is_example:
        return True
    if row.is_shared:
        return True
    return is_dataset_referenced_by_published_story(session, row.id)


def can_read_connection(
    session: Session, row: ConnectionRow, workspace_id: str
) -> bool:
    """Apply the public read policy to a connection row."""
    if row.workspace_id and workspace_id and row.workspace_id == workspace_id:
        return True
    if row.is_shared:
        return True
    return is_connection_referenced_by_published_story(session, row.id)
