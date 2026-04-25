import logging
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.base import Base


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def fresh_app():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    app = create_app(settings, lifespan=_noop_lifespan)
    app.state.db_session_factory = sessionmaker(bind=engine)
    app.state.limiter.reset()
    yield app
    app.state.limiter.reset()
    engine.dispose()


@pytest.fixture
def fresh_client(fresh_app):
    return TestClient(fresh_app, raise_server_exceptions=False)


def test_bug_report_decorator_fires_429_after_limit(fresh_client):
    payload = {
        "page_url": "https://example.com",
        "dataset_id": "abc",
    }
    headers = {"X-Workspace-Id": "ws111111"}
    statuses = []
    for _ in range(7):
        resp = fresh_client.post("/api/bug-report", json=payload, headers=headers)
        statuses.append(resp.status_code)
    assert 429 in statuses
    assert statuses.index(429) >= 5


def test_handler_logs_grep_friendly_warning(fresh_client, caplog):
    payload = {"page_url": "https://example.com", "dataset_id": "abc"}
    headers = {"X-Workspace-Id": "ws222222"}
    with caplog.at_level(logging.WARNING, logger="src.rate_limit"):
        for _ in range(7):
            fresh_client.post("/api/bug-report", json=payload, headers=headers)
    matches = [r for r in caplog.records if "rate_limit_exceeded" in r.getMessage()]
    assert matches, "expected at least one rate_limit_exceeded warning"
    msg = matches[0].getMessage()
    assert "path=/api/bug-report" in msg
    assert "workspace=ws222222" in msg
    assert "limit=" in msg


def test_workspace_keying_independent_counters(fresh_client):
    payload = {"page_url": "https://example.com", "dataset_id": "abc"}
    for _ in range(5):
        resp = fresh_client.post(
            "/api/bug-report", json=payload, headers={"X-Workspace-Id": "wsAAAAAA"}
        )
        assert resp.status_code != 429
    resp = fresh_client.post(
        "/api/bug-report", json=payload, headers={"X-Workspace-Id": "wsAAAAAA"}
    )
    assert resp.status_code == 429
    resp = fresh_client.post(
        "/api/bug-report", json=payload, headers={"X-Workspace-Id": "wsBBBBBB"}
    )
    assert resp.status_code != 429


def test_ip_fallback_when_no_workspace_header(fresh_app, caplog):
    client = TestClient(fresh_app, raise_server_exceptions=False)
    payload = {"page_url": "https://example.com", "dataset_id": "abc"}
    with caplog.at_level(logging.WARNING, logger="src.rate_limit"):
        for _ in range(7):
            client.post("/api/bug-report", json=payload)
    matches = [r for r in caplog.records if "rate_limit_exceeded" in r.getMessage()]
    assert matches
    msg = matches[0].getMessage()
    assert "workspace=None" in msg
    assert "ip=" in msg


def test_default_limit_applies_to_undecorated_endpoint(fresh_app):
    from slowapi.wrappers import LimitGroup

    limiter = fresh_app.state.limiter
    original = limiter._default_limits
    limiter._default_limits = [
        LimitGroup(
            "3/minute", limiter._key_func, None, False, None, None, None, 1, False
        )
    ]
    try:
        client = TestClient(fresh_app, raise_server_exceptions=False)
        statuses = [
            client.get(
                "/api/health", headers={"X-Workspace-Id": "wsCCCCCC"}
            ).status_code
            for _ in range(5)
        ]
    finally:
        limiter._default_limits = original
    assert 429 in statuses
    assert statuses.index(429) == 3
