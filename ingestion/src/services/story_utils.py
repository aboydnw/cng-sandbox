"""Shared utilities for story-dataset references."""

import json

from sqlalchemy.orm import Session

from src.models.story import StoryRow


def _story_references_dataset(row: StoryRow, dataset_id: str) -> bool:
    """Check whether a single story row references the given dataset."""
    if row.dataset_id == dataset_id:
        return True
    chapters = json.loads(row.chapters_json) if row.chapters_json else []
    for ch in chapters:
        lc = ch.get("layer_config") or {}
        if lc.get("dataset_id") == dataset_id:
            return True
    return False


def find_stories_referencing_dataset(session: Session, dataset_id: str) -> list[str]:
    """Return IDs of stories that reference *dataset_id*."""
    return [
        row.id
        for row in session.query(StoryRow).all()
        if _story_references_dataset(row, dataset_id)
    ]


def build_story_count_map(session: Session) -> dict[str, int]:
    """Build a {dataset_id: count} lookup for all stories in one query.

    Avoids the N+1 problem when listing datasets.
    """
    counts: dict[str, int] = {}
    for row in session.query(StoryRow).all():
        seen: set[str] = set()
        if row.dataset_id:
            seen.add(row.dataset_id)
        chapters = json.loads(row.chapters_json) if row.chapters_json else []
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            did = lc.get("dataset_id")
            if did:
                seen.add(did)
        for did in seen:
            counts[did] = counts.get(did, 0) + 1
    return counts
