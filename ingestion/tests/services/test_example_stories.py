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
    LAHAINA_POST_URL,
    LAHAINA_PRE_URL,
    OCEAN_FLOOR_STORY,
    relink_dead_chapter_dataset_ids,
    seed_example_stories,
)


def _make_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    # Match the partial unique index installed by _migrate_schema so tests
    # cover the concurrent-insert guard too.
    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_stories_example_title "
                "ON stories (title) WHERE is_example"
            )
        )
        conn.commit()
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
        _seed_example_dataset(
            session,
            ds_id="lahaina-pre-id",
            source_url=LAHAINA_PRE_URL,
            filename="Lahaina Pre",
        )
        _seed_example_dataset(
            session,
            ds_id="lahaina-post-id",
            source_url=LAHAINA_POST_URL,
            filename="Lahaina Post",
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
        count = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).count()
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
            for r in session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
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
        assert required.issubset(types), (
            f"story {story.title!r} missing chapter types: {required - types}"
        )


def test_each_story_has_between_six_and_ten_chapters():
    for story in ALL_STORIES:
        assert 6 <= len(story.chapters) <= 10, (
            f"story {story.title!r} has {len(story.chapters)} chapters"
        )


def test_concurrent_insert_of_same_title_is_no_op():
    """A second seeder that races past the title-check still can't duplicate."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)

    seed_example_stories(factory)

    # Simulate a racing second process by directly attempting a duplicate
    # insert bypassing the title cache — the partial unique index should
    # reject it, and seed_example_stories should then catch IntegrityError.
    session = factory()
    try:
        session.add(
            StoryRow(
                id="dup",
                title=OCEAN_FLOOR_STORY.title,
                chapters_json="[]",
                published=True,
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        raised = False
        try:
            session.commit()
        except Exception:
            session.rollback()
            raised = True
    finally:
        session.close()

    assert raised, "partial unique index must reject duplicate example title"

    # And a repeat seed still lands at exactly the expected story count.
    seed_example_stories(factory)
    session = factory()
    try:
        count = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).count()
    finally:
        session.close()
    assert count == len(ALL_STORIES)


def _wipe_example_datasets(factory):
    """Delete every is_example dataset row (simulates a wipe + re-seed)."""
    session = factory()
    try:
        session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).delete()
        session.commit()
    finally:
        session.close()


def _reseed_example_datasets_with_new_ids(factory, suffix: str):
    """Re-insert example datasets under fresh IDs.

    Used to simulate the production failure mode: a database wipe produces
    new randomly-assigned dataset rows, and any story whose chapters point
    at the old IDs now references rows that no longer exist.
    """
    _wipe_example_datasets(factory)
    session = factory()
    try:
        for source_url, label in [
            (GEBCO_URL, "GEBCO"),
            (GHRSST_URL, "GHRSST"),
            (CARBON_URL, "Carbon"),
            (BUILDINGS_URL, "Buildings"),
            (LAHAINA_PRE_URL, "LahainaPre"),
            (LAHAINA_POST_URL, "LahainaPost"),
        ]:
            _seed_example_dataset(
                session,
                ds_id=f"{label.lower()}-{suffix}",
                source_url=source_url,
                filename=label,
            )
        session.commit()
    finally:
        session.close()


def test_seed_example_stories_heals_chapter_drift():
    """A second seed with new dataset IDs rewrites stale chapter dataset_ids."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    _reseed_example_datasets_with_new_ids(factory, suffix="fresh")
    seed_example_stories(factory)

    session = factory()
    try:
        rows = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        live_ids = {r.id for r in session.query(DatasetRow).all()}
    finally:
        session.close()

    for row in rows:
        chapters = json.loads(row.chapters_json)
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            ds_id = lc.get("dataset_id")
            if ds_id is None:
                continue
            assert ds_id in live_ids, (
                f"chapter dataset_id {ds_id} in {row.title!r} is dead after re-seed"
            )


def test_seed_example_stories_preserves_row_id_across_refresh():
    """An UPDATE keeps the example story's id stable so forks still resolve."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    session = factory()
    try:
        original_ids = {
            r.title: r.id
            for r in session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        }
    finally:
        session.close()

    _reseed_example_datasets_with_new_ids(factory, suffix="v2")
    seed_example_stories(factory)

    session = factory()
    try:
        new_ids = {
            r.title: r.id
            for r in session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        }
    finally:
        session.close()

    assert new_ids == original_ids


def test_relink_rewrites_dead_chapter_dataset_ids_in_fork():
    """A fork referencing a dead dataset_id is healed via the seed catalog."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    # Snapshot the example story so we can build a fork that mirrors its chapters.
    session = factory()
    try:
        example = (
            session.query(StoryRow)
            .filter(
                StoryRow.is_example.is_(True),
                StoryRow.title == OCEAN_FLOOR_STORY.title,
            )
            .one()
        )
        example_id = example.id
        original_chapters = json.loads(example.chapters_json)
    finally:
        session.close()

    # The fork's chapters point at non-existent dataset IDs (simulates a
    # fork that was created before the example datasets got new IDs).
    forked_chapters = json.loads(json.dumps(original_chapters))
    for ch in forked_chapters:
        lc = ch.get("layer_config")
        if lc and lc.get("dataset_id"):
            lc["dataset_id"] = "dead-id-from-old-deploy"

    now = datetime.now(UTC)
    session = factory()
    try:
        session.add(
            StoryRow(
                id="fork-1",
                title=OCEAN_FLOOR_STORY.title,
                description="forked",
                chapters_json=json.dumps(forked_chapters),
                published=False,
                is_example=False,
                workspace_id="ws-eedwio93",
                forked_from_id=example_id,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    finally:
        session.close()

    relinked = relink_dead_chapter_dataset_ids(factory)
    assert relinked == 1

    session = factory()
    try:
        fork = session.get(StoryRow, "fork-1")
        live_ids = {r.id for r in session.query(DatasetRow).all()}
    finally:
        session.close()

    rewritten = json.loads(fork.chapters_json)
    for ch in rewritten:
        lc = ch.get("layer_config") or {}
        ds_id = lc.get("dataset_id")
        if ds_id is not None:
            assert ds_id in live_ids


def test_relink_preserves_live_chapter_dataset_ids():
    """Chapters pointing at existing datasets are not rewritten."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    session = factory()
    try:
        before = json.loads(
            (
                session.query(StoryRow)
                .filter(StoryRow.title == OCEAN_FLOOR_STORY.title)
                .one()
            ).chapters_json
        )
    finally:
        session.close()

    relinked = relink_dead_chapter_dataset_ids(factory)
    assert relinked == 0

    session = factory()
    try:
        after = json.loads(
            (
                session.query(StoryRow)
                .filter(StoryRow.title == OCEAN_FLOOR_STORY.title)
                .one()
            ).chapters_json
        )
    finally:
        session.close()

    assert before == after


def test_relink_skips_when_chapter_count_diverges():
    """A fork whose user-edited chapters no longer align with the seed is
    skipped to avoid mis-positioning dataset replacements."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    session = factory()
    try:
        example_id = (
            session.query(StoryRow)
            .filter(
                StoryRow.is_example.is_(True),
                StoryRow.title == OCEAN_FLOOR_STORY.title,
            )
            .one()
            .id
        )
    finally:
        session.close()

    # Build a fork with only one chapter, all dead — definitely doesn't
    # match the seed shape.
    now = datetime.now(UTC)
    short_chapter = {
        "id": "ch-short",
        "order": 0,
        "type": "scrollytelling",
        "title": "truncated",
        "narrative": "",
        "map_state": {
            "center": [0, 0],
            "zoom": 0,
            "bearing": 0,
            "pitch": 0,
            "basemap": "streets",
        },
        "transition": "fly-to",
        "overlay_position": "left",
        "layer_config": {
            "dataset_id": "dead-id",
            "colormap": "viridis",
            "opacity": 0.85,
            "basemap": "streets",
        },
    }
    session = factory()
    try:
        session.add(
            StoryRow(
                id="short-fork",
                title=OCEAN_FLOOR_STORY.title,
                description="shortened",
                chapters_json=json.dumps([short_chapter]),
                published=False,
                is_example=False,
                workspace_id="ws",
                forked_from_id=example_id,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    finally:
        session.close()

    relinked = relink_dead_chapter_dataset_ids(factory)
    assert relinked == 0

    session = factory()
    try:
        row = session.get(StoryRow, "short-fork")
        chapters = json.loads(row.chapters_json)
    finally:
        session.close()

    assert chapters[0]["layer_config"]["dataset_id"] == "dead-id"


def test_relink_skips_user_authored_story_with_coincidental_title_match():
    """A user-authored story (not an example, not a fork) whose title
    happens to match a seed must not have its chapter dataset_ids
    rewritten — the user wrote those chapters, not the seed catalog."""
    _, factory = _make_db()
    _seed_all_example_datasets(factory)
    seed_example_stories(factory)

    seed_chapter_count = len(OCEAN_FLOOR_STORY.chapters)
    user_chapters = [
        {
            "id": f"ch-{i}",
            "order": i,
            "type": "scrollytelling",
            "title": f"user chapter {i}",
            "narrative": "",
            "map_state": {
                "center": [0, 0],
                "zoom": 0,
                "bearing": 0,
                "pitch": 0,
                "basemap": "streets",
            },
            "transition": "fly-to",
            "overlay_position": "left",
            "layer_config": {
                "dataset_id": "user-private-dead-id",
                "colormap": "viridis",
                "opacity": 0.85,
                "basemap": "streets",
            },
        }
        for i in range(seed_chapter_count)
    ]
    now = datetime.now(UTC)
    session = factory()
    try:
        session.add(
            StoryRow(
                id="user-story",
                title=OCEAN_FLOOR_STORY.title,
                description="user authored",
                chapters_json=json.dumps(user_chapters),
                published=False,
                is_example=False,
                workspace_id="ws",
                forked_from_id=None,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    finally:
        session.close()

    relinked = relink_dead_chapter_dataset_ids(factory)
    assert relinked == 0

    session = factory()
    try:
        row = session.get(StoryRow, "user-story")
        chapters = json.loads(row.chapters_json)
    finally:
        session.close()

    for ch in chapters:
        assert ch["layer_config"]["dataset_id"] == "user-private-dead-id"
