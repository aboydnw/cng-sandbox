"""Startup task: seed curated example connections (e.g. zarr URLs).

On ingestion boot, register each entry in `EXAMPLE_CONNECTIONS` as a
`ConnectionRow` with `is_example=True` and `workspace_id=None`. Idempotent
across restarts: the `(url, connection_type)` pair is the seed key, so
re-runs skip already-present rows. Mirrors the pattern in
`example_datasets.py` / `example_stories.py`.

The list of curated connections is intentionally short at MVP (one zarr
store). Add new entries to `EXAMPLE_CONNECTIONS` to grow the seed.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import sessionmaker

from src.models.connection import ConnectionRow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExampleConnectionSeed:
    """A curated connection that ships with every fresh deploy."""

    name: str
    url: str
    connection_type: str
    config: dict[str, Any] = field(default_factory=dict)
    bounds: list[float] | None = None
    rescale: str | None = None
    band_count: int | None = None
    tile_type: str | None = None
    preferred_colormap: str | None = None
    preferred_colormap_reversed: bool | None = None


EXAMPLE_CONNECTIONS: list[ExampleConnectionSeed] = []


def _existing_connection_keys(
    db_session_factory: sessionmaker,
) -> set[tuple[str, str]]:
    """Return {(url, connection_type)} for every ConnectionRow.

    We dedupe against ALL existing rows (not just `is_example=True`) so that
    a pre-existing user-owned connection with the same `(url, connection_type)`
    is not duplicated as an example row.
    """
    session = db_session_factory()
    try:
        rows = session.query(ConnectionRow).all()
        return {(r.url, r.connection_type) for r in rows}
    finally:
        session.close()


def seed_example_connections(db_session_factory: sessionmaker) -> None:
    """Insert every entry in `EXAMPLE_CONNECTIONS` not already present.

    Idempotent: a `(url, connection_type)` pair already present in the
    `connections` table is skipped, regardless of whether the existing row
    is an example row or a workspace-owned row. Errors on individual seeds
    are logged but do not abort the rest of the batch.
    """
    if not EXAMPLE_CONNECTIONS:
        logger.info("No example connections defined; skipping seed")
        return
    existing = _existing_connection_keys(db_session_factory)
    session = db_session_factory()
    try:
        for seed in EXAMPLE_CONNECTIONS:
            key = (seed.url, seed.connection_type)
            if key in existing:
                logger.info(
                    "example connection already present, skipping: %s", seed.name
                )
                continue
            try:
                row = ConnectionRow(
                    id=str(uuid.uuid4()),
                    name=seed.name,
                    url=seed.url,
                    connection_type=seed.connection_type,
                    bounds_json=(json.dumps(seed.bounds) if seed.bounds else None),
                    rescale=seed.rescale,
                    band_count=seed.band_count,
                    tile_type=seed.tile_type,
                    workspace_id=None,
                    is_example=True,
                    config=seed.config or None,
                    preferred_colormap=seed.preferred_colormap,
                    preferred_colormap_reversed=seed.preferred_colormap_reversed,
                    created_at=datetime.now(UTC),
                )
                session.add(row)
                session.commit()
                existing.add(key)
                logger.info("registered example connection: %s", seed.name)
            except Exception:
                session.rollback()
                logger.exception("Failed to register example connection: %s", seed.name)
    finally:
        session.close()
