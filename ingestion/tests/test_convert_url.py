from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.config import Settings


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def client():
    settings = Settings(
        s3_endpoint="http://fake:9000",
        stac_api_url="http://fake:8081",
        cors_origins=["*"],
        postgres_dsn="sqlite:///:memory:",
    )
    app = create_app(settings=settings, lifespan=_noop_lifespan)
    with TestClient(app, headers={"X-Workspace-Id": "testABCD"}) as c:
        yield c


def test_convert_url_rejects_file_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "file:///etc/passwd"})
    assert resp.status_code == 422


def test_convert_url_rejects_ftp_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "ftp://example.com/data.tif"})
    assert resp.status_code == 422


def test_convert_url_rejects_empty_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "/etc/passwd"})
    assert resp.status_code == 422


def test_convert_url_blocks_loopback():
    from src.routes.upload import ConvertUrlRequest

    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://127.0.0.1:9000/bucket/file.tif")


def test_convert_url_blocks_private_ip():
    from src.routes.upload import ConvertUrlRequest

    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://10.0.0.1/file.tif")


def test_convert_url_allows_public():
    from src.routes.upload import ConvertUrlRequest

    req = ConvertUrlRequest(url="https://example.com/file.tif")
    assert req.url == "https://example.com/file.tif"


def test_url_http_403_error_message():
    from src.routes.upload import _format_http_error
    msg = _format_http_error(403, "Forbidden")
    assert "403" in msg
    assert "Forbidden" in msg
    assert "authentication" in msg.lower()


def test_url_http_404_error_message():
    from src.routes.upload import _format_http_error
    msg = _format_http_error(404, "Not Found")
    assert "404" in msg
    assert "not found" in msg.lower()


def test_url_http_generic_error_message():
    from src.routes.upload import _format_http_error
    msg = _format_http_error(502, "Bad Gateway")
    assert "502" in msg
    assert "Bad Gateway" in msg


def test_url_connection_error_message():
    from src.routes.upload import _format_connection_error
    msg = _format_connection_error("example.com")
    assert "example.com" in msg


def test_url_timeout_error_message():
    from src.routes.upload import _format_timeout_error
    msg = _format_timeout_error("example.com")
    assert "timed out" in msg.lower()
    assert "example.com" in msg
