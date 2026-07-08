from contextlib import asynccontextmanager

from fastapi.testclient import TestClient

from src.app import create_app
from src.config import Settings


@asynccontextmanager
async def _noop_lifespan(app):
    from src.models.base import Base

    Base.metadata.create_all(app.state.db_engine)
    yield


def _client(**overrides):
    settings = Settings(
        postgres_dsn="sqlite:///:memory:",
        **overrides,
    )
    return TestClient(create_app(settings=settings, lifespan=_noop_lifespan))


def test_config_reports_disabled_when_flag_off():
    client = _client(chat_enabled=False, anthropic_api_key_chat="sk-test")
    resp = client.get("/api/chat/config")
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False}


def test_config_reports_disabled_when_key_missing():
    client = _client(chat_enabled=True, anthropic_api_key_chat="")
    assert client.get("/api/chat/config").json() == {"enabled": False}


def test_config_reports_enabled_when_flag_and_key_present():
    client = _client(chat_enabled=True, anthropic_api_key_chat="sk-test")
    assert client.get("/api/chat/config").json() == {"enabled": True}
