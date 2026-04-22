"""Tests for the example-stories seed task."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.example_stories import (
    ALL_STORIES,
    BUILDINGS_URL,
    CARBON_URL,
    GEBCO_URL,
    GHRSST_URL,
    OCEAN_FLOOR_STORY,
    seed_example_stories,
)


def _make_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine)


def _seed_example_dataset(session, *, ds_id: str, source_url: str, filename: str):
    session.add(
        DatasetRow(
            id=ds_id,
            filename=filename,
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url=f"/raster/t/{ds_id}",
            metadata_json=json.dumps({"source_url": source_url}),
            is_example=True,
            workspace_id=None,
            created_at=datetime.now(UTC),
        )
    )


def _seed_all_example_datasets(factory):
    session = factory()
    try:
        _seed_example_dataset(
            session, ds_id="gebco-id", source_url=GEBCO_URL, filename="GEBCO"
        )
        _seed_example_dataset(
            session, ds_id="ghrsst-id", source_url=GHRSST_URL, filename="GHRSST"
        )
        _seed_example_dataset(
            session, ds_id="carbon-id", source_url=CARBON_URL, filename="Carbon"
        )
        _seed_example_dataset(
            session,
            ds_id="buildings-id",
            source_url=BUILDINGS_URL,
            filename="Buildings",
        )
        session.commit()
    finally:
        session.close()


def test_seed_inserts_stories_when_datasets_present():
    _, factory = _make_db()
    _seed_all_example_datasets(factory)

    seed_example_stories(factory)

    session = factory()
    try:
        rows = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
    finally:
        session.close()

    titles = {r.title for r in rows}
    assert titles == {s.title for s in ALL_STORIES}
    for row in rows:
        assert row.published is True
        assert row.workspace_id is None
        assert row.is_example is True


def test_seed_is_idempotent_on_repeat_call():
    _, factory = _make_db()
    _seed_all_example_datasets(factory)

    seed_example_stories(factory)
    seed_example_stories(factory)

    session = factory()
    try:
        count = (
            session.query(StoryRow).filter(StoryRow.is_example.is_(True)).count()
        )
    finally:
        session.close()

    assert count == len(ALL_STORIES)


def test_seed_skips_story_when_dataset_missing():
    """With only GEBCO registered, only the GEBCO-only story seeds."""
    _, factory = _make_db()
    session = factory()
    try:
        _seed_example_dataset(
            session, ds_id="gebco-id", source_url=GEBCO_URL, filename="GEBCO"
        )
        session.commit()
    finally:
        session.close()

    seed_example_stories(factory)

    session = factory()
    try:
        titles = {
            r.title
            for r in session.query(StoryRow)
            .filter(StoryRow.is_example.is_(True))
            .all()
        }
    finally:
        session.close()

    assert titles == {OCEAN_FLOOR_STORY.title}


def test_seed_populates_chapter_layer_config_with_resolved_dataset_id():
    _, factory = _make_db()
    _seed_all_example_datasets(factory)

    seed_example_stories(factory)

    session = factory()
    try:
        row = (
            session.query(StoryRow)
            .filter(StoryRow.title == OCEAN_FLOOR_STORY.title)
            .one()
        )
        chapters = json.loads(row.chapters_json)
    finally:
        session.close()

    raster_chapter = next(c for c in chapters if c["type"] == "scrollytelling")
    assert raster_chapter["layer_config"]["dataset_id"] == "gebco-id"
    assert raster_chapter["layer_config"]["colormap"] == "terrain"


def test_seed_prose_chapter_has_null_layer_config():
    _, factory = _make_db()
    _seed_all_example_datasets(factory)

    seed_example_stories(factory)

    session = factory()
    try:
        row = (
            session.query(StoryRow)
            .filter(StoryRow.title == OCEAN_FLOOR_STORY.title)
            .one()
        )
        chapters = json.loads(row.chapters_json)
    finally:
        session.close()

    prose = next(c for c in chapters if c["type"] == "prose")
    assert prose["layer_config"] is None


def test_each_story_covers_all_three_chapter_types():
    required = {"scrollytelling", "prose", "map"}
    for story in ALL_STORIES:
        types = {ch.type for ch in story.chapters}
        assert required.issubset(
            types
        ), f"story {story.title!r} missing chapter types: {required - types}"


def test_each_story_has_between_six_and_ten_chapters():
    for story in ALL_STORIES:
        assert 6 <= len(story.chapters) <= 10, (
            f"story {story.title!r} has {len(story.chapters)} chapters"
        )
