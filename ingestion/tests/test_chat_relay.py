import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.app import create_app
from src.config import Settings
from src.models.base import Base
from src.models.story import StoryRow


@asynccontextmanager
async def _noop_lifespan(app):
    yield


def _client(monkeypatch, **overrides):
    async def _fake_stream(**kwargs):
        kwargs["on_output_tokens"](5)
        yield {"event": "text", "data": json.dumps({"text": "hi"})}
        yield {"event": "done", "data": json.dumps({"stop_reason": "end_turn"})}

    monkeypatch.setattr("src.routes.chat.stream_anthropic", _fake_stream)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    session.add(
        StoryRow(
            id="s1",
            title="T",
            description="d",
            chapters_json="[]",
            published=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    session.commit()
    session.close()

    params = {"chat_enabled": True, "anthropic_api_key_chat": "sk-test"}
    params.update(overrides)
    settings = Settings(postgres_dsn="sqlite:///:memory:", **params)
    app = create_app(settings=settings, lifespan=_noop_lifespan)
    app.state.db_engine = engine
    app.state.db_session_factory = factory
    return TestClient(app, raise_server_exceptions=False)


def test_post_chat_404_when_disabled(monkeypatch):
    client = _client(monkeypatch, chat_enabled=False)
    resp = client.post("/api/chat", json={"story_id": "s1", "messages": []})
    assert resp.status_code == 404


def test_post_chat_rejects_over_turn_cap(monkeypatch):
    client = _client(monkeypatch, chat_max_turns=2)
    msgs = [{"role": "user", "content": "q"} for _ in range(3)]
    resp = client.post("/api/chat", json={"story_id": "s1", "messages": msgs})
    assert resp.status_code == 400


def test_post_chat_503_when_budget_exhausted(monkeypatch):
    client = _client(monkeypatch, chat_daily_token_budget=0)
    resp = client.post(
        "/api/chat",
        json={"story_id": "s1", "messages": [{"role": "user", "content": "q"}]},
    )
    assert resp.status_code == 503


def test_post_chat_rejects_oversized_message(monkeypatch):
    client = _client(monkeypatch)
    resp = client.post(
        "/api/chat",
        json={"story_id": "s1", "messages": [{"role": "user", "content": "x" * 20000}]},
    )
    assert resp.status_code == 400


def test_chat_rate_limit_shared_across_workspace_rotation(monkeypatch):
    from src.rate_limit import limiter

    client = _client(monkeypatch)
    limiter.reset()
    try:
        statuses = []
        for i in range(12):
            resp = client.post(
                "/api/chat",
                json={
                    "story_id": "s1",
                    "messages": [{"role": "user", "content": "q"}],
                },
                headers={"X-Workspace-Id": f"ws{i:06d}"},
            )
            statuses.append(resp.status_code)
    finally:
        limiter.reset()
    assert statuses[0] == 200
    assert 429 in statuses


def test_post_chat_streams_relayed_events(monkeypatch):
    client = _client(monkeypatch)
    resp = client.post(
        "/api/chat",
        json={"story_id": "s1", "messages": [{"role": "user", "content": "q"}]},
    )
    assert resp.status_code == 200
    body = resp.text
    assert "event: text" in body
    assert "event: done" in body
