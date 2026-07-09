import json
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.base import Base
from src.models.connection import ConnectionRow
from src.models.story import StoryRow
from src.services import chat_context


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _story(session):
    conn = ConnectionRow(
        id="c1",
        name="Sea Surface Temp",
        connection_type="cog",
        url="https://x/y.tif",
        band_count=1,
        is_categorical=False,
    )
    session.add(conn)
    story = StoryRow(
        id="s1",
        title="Warming Bay",
        description="Heat over time",
        chapters_json=json.dumps(
            [
                {"type": "prose", "title": "Intro", "narrative": "The bay warms."},
                {
                    "type": "scrollytelling",
                    "title": "Peak heat",
                    "narrative": "Hottest here.",
                    "layer_config": {"connection_id": "c1", "colormap": "viridis"},
                    "map_state": {
                        "center": [0, 0],
                        "zoom": 3,
                        "bearing": 0,
                        "pitch": 0,
                        "basemap": "light",
                    },
                },
            ]
        ),
        published=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(story)
    session.commit()
    return story


def test_context_includes_title_chapters_and_layer_metadata():
    session = _session()
    story = _story(session)
    md = chat_context.build_story_context_markdown(story, session)
    assert "Warming Bay" in md
    assert "Peak heat" in md
    assert "Sea Surface Temp" in md


def test_system_blocks_are_cacheable_and_padded():
    session = _session()
    story = _story(session)
    blocks = chat_context.build_system_blocks(story, session, min_tokens=4096)
    assert blocks[0]["cache_control"] == {"type": "ephemeral"}
    assert len(blocks[0]["text"]) >= 4096 * 4


def test_malformed_chapters_json_does_not_raise():
    session = _session()
    story = StoryRow(
        id="s2",
        title="Bad Chapters",
        description=None,
        chapters_json="{not valid json",
        published=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(story)
    session.commit()
    md = chat_context.build_story_context_markdown(story, session)
    assert "Bad Chapters" in md


def test_block_cache_evicts_oldest_entry_past_cap(monkeypatch):
    from collections import OrderedDict

    session = _session()
    monkeypatch.setattr(chat_context, "_BLOCK_CACHE", OrderedDict())
    monkeypatch.setattr(chat_context, "_BLOCK_CACHE_MAX", 2)
    stories = []
    for i in range(3):
        story = StoryRow(
            id=f"cache-{i}",
            title=f"Story {i}",
            description=None,
            chapters_json="[]",
            published=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(story)
        session.commit()
        stories.append(story)

    for story in stories:
        chat_context.build_system_blocks(story, session)

    assert len(chat_context._BLOCK_CACHE) == 2
    cached_ids = [key[0] for key in chat_context._BLOCK_CACHE]
    assert cached_ids == ["cache-1", "cache-2"]


def test_system_blocks_are_byte_stable_across_calls():
    session = _session()
    story = _story(session)
    a = chat_context.build_system_blocks(story, session)
    b = chat_context.build_system_blocks(story, session)
    assert a == b
