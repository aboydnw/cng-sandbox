from contextlib import asynccontextmanager
from unittest.mock import patch, MagicMock

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
def github_client():
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
        github_token="fake-token",
        github_repo="org/repo",
    )
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    app = create_app(settings, lifespan=_noop_lifespan)
    app.state.db_session_factory = sessionmaker(bind=engine)
    yield TestClient(app, raise_server_exceptions=False)
    engine.dispose()


def test_submit_bug_report_creates_github_issue(github_client):
    payload = {
        "description": "Map colors look wrong",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [
            {"timestamp": "2026-03-22T10:00:00Z", "level": "error", "message": "tile load failed"},
        ],
    }
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"html_url": "https://github.com/org/repo/issues/1"}
    mock_response.raise_for_status = MagicMock()

    with patch("src.routes.bug_report.httpx.post", return_value=mock_response):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 200
    assert resp.json()["issue_url"] == "https://github.com/org/repo/issues/1"


def test_submit_bug_report_requires_context(github_client):
    payload = {
        "description": "Something broke",
        "page_url": "/map/ds-123",
        "console_logs": [],
    }
    resp = github_client.post("/api/bug-report", json=payload)
    assert resp.status_code == 422


def test_submit_bug_report_with_story_context(github_client):
    payload = {
        "description": "",
        "page_url": "/story/s-456",
        "story_id": "s-456",
        "dataset_ids": ["ds-1", "ds-2"],
        "console_logs": [],
    }
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"html_url": "https://github.com/org/repo/issues/2"}
    mock_response.raise_for_status = MagicMock()

    with patch("src.routes.bug_report.httpx.post", return_value=mock_response):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 200


def test_submit_bug_report_github_unavailable(github_client):
    payload = {
        "description": "Broken",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [],
    }
    with patch("src.routes.bug_report.httpx.post", side_effect=Exception("connection failed")):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 502


def test_submit_bug_report_not_configured(client):
    payload = {
        "description": "",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [],
    }
    resp = client.post("/api/bug-report", json=payload)
    assert resp.status_code == 503
