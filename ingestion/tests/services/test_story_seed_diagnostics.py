"""Regression coverage for the example-story seeding progress logs."""

from __future__ import annotations

import pytest

from src.models.base import Base


@pytest.fixture
def db_session_factory(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(f"sqlite:///{tmp_path}/test.db")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


class _App:
    def __init__(self, db_session_factory):
        self.state = type("S", (), {"db_session_factory": db_session_factory})()


@pytest.mark.asyncio
async def test_give_up_log_names_the_stories_that_never_seeded(
    db_session_factory, monkeypatch, caplog
):
    import src.app as app_module

    monkeypatch.setattr(app_module, "STORY_SEED_MAX_ATTEMPTS", 1)
    monkeypatch.setattr(app_module, "STORY_SEED_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(
        "src.services.example_stories.seed_example_stories", lambda _f: None
    )
    monkeypatch.setattr(
        "src.services.example_stories.relink_dead_chapter_dataset_ids",
        lambda _f: None,
    )

    from src.services.example_stories import ALL_STORIES

    with caplog.at_level("ERROR"):
        await app_module._seed_stories(_App(db_session_factory))

    # Nothing seeded, so every canonical title must be named in the give-up log.
    for story in ALL_STORIES:
        assert story.title in caplog.text
