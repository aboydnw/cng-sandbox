"""Redirect-based SSRF protection tests for URL-fetching callers.

validate_url_safe cannot inspect the target of a 3xx redirect, so each
URL-fetching call site must pass follow_redirects=False and reject 3xx.
These tests confirm that a 302 to a private IP is rejected for every
user-facing call site.
"""

from __future__ import annotations

from typing import ClassVar
from unittest.mock import MagicMock

import pytest

from src.models import Job
from src.services.url_validation import SSRFError


class _RedirectStream:
    status_code = 302
    headers: ClassVar[dict] = {"location": "http://127.0.0.1/secret"}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def aiter_bytes(self, chunk_size=None):
        if False:
            yield b""

    def raise_for_status(self):
        pass


class _RedirectAsyncClient:
    def __init__(self, **kwargs):
        assert kwargs.get("follow_redirects") is False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def stream(self, method, url, **kwargs):
        return _RedirectStream()

    async def head(self, url, **kwargs):
        return MagicMock(
            status_code=302,
            headers={"location": "http://127.0.0.1/secret"},
            is_success=False,
        )

    async def get(self, url, **kwargs):
        return MagicMock(
            status_code=302,
            headers={"location": "http://127.0.0.1/secret", "content-type": "text/html"},
            text="",
        )


def test_convert_url_rejects_redirect(client, monkeypatch):
    monkeypatch.setattr("src.routes.upload.httpx.AsyncClient", _RedirectAsyncClient)
    resp = client.post(
        "/api/convert-url", json={"url": "https://example.com/file.tif"}
    )
    assert resp.status_code == 400
    assert "redirect" in resp.json()["detail"].lower()


def test_inspect_url_rejects_redirect(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(
            status_code=302,
            headers={"location": "http://127.0.0.1/secret"},
            is_success=False,
        )

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/data.pmtiles"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_errors"] is True
    assert "redirect" in body["error_detail"].lower()


def test_discover_rejects_redirect(client, monkeypatch):
    monkeypatch.setattr(
        "src.services.discovery.httpx.AsyncClient", _RedirectAsyncClient
    )
    resp = client.post("/api/discover", json={"url": "https://example.com/listing/"})
    assert resp.status_code == 400
    assert "redirect" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_remote_pipeline_head_rejects_redirect(monkeypatch):
    from src.services import remote_pipeline

    class FakeResponse:
        status_code = 302
        headers: ClassVar[dict] = {
            "location": "http://127.0.0.1/secret",
            "content-length": "1000",
        }

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def head(self, url, follow_redirects=False):
            return FakeResponse()

    monkeypatch.setattr(remote_pipeline.httpx, "AsyncClient", FakeClient)

    result = await remote_pipeline._estimate_total_size(["https://example.com/a.tif"])
    assert result is None


@pytest.mark.asyncio
async def test_remote_pipeline_download_rejects_redirect(monkeypatch, tmp_path):
    from src.models import JobStatus
    from src.services import remote_pipeline
    from src.services.cog_checker import CogCheckResult

    monkeypatch.setattr(
        remote_pipeline,
        "check_remote_is_cog",
        lambda url: _coro(
            CogCheckResult(is_cog=False, has_tiling=False, has_overviews=False)
        ),
    )

    monkeypatch.setattr(
        remote_pipeline,
        "_estimate_total_size",
        lambda urls: _coro(1000),
    )

    class FakeStreamResp:
        status_code = 302

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def aiter_bytes(self, chunk_size=None):
            if False:
                yield b""

        def raise_for_status(self):
            pass

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        def stream(self, method, url, follow_redirects=False):
            return FakeStreamResp()

    monkeypatch.setattr(remote_pipeline.httpx, "AsyncClient", FakeClient)

    job = Job(filename="a.tif", workspace_id="ws1")
    await remote_pipeline.run_remote_pipeline(
        job,
        [{"url": "https://example.com/a.tif", "filename": "a.tif"}],
        mode="mosaic",
        db_session_factory=MagicMock(),
    )

    assert job.status == JobStatus.FAILED


def test_geoparquet_download_rejects_redirect(monkeypatch, tmp_path):
    from src.services import geoparquet_to_pmtiles

    class FakeResp:
        status_code = 302

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def raise_for_status(self):
            pass

        def iter_bytes(self, chunk_size=None):
            return iter([])

    def fake_stream(method, url, **kwargs):
        assert kwargs.get("follow_redirects") is False
        return FakeResp()

    monkeypatch.setattr(geoparquet_to_pmtiles.httpx, "stream", fake_stream)

    with pytest.raises(SSRFError):
        geoparquet_to_pmtiles._download_if_remote(
            "https://example.com/data.parquet", str(tmp_path)
        )


async def _coro(value):
    return value


def test_proxy_already_rejects_redirects():
    import inspect

    from src.routes import proxy

    source = inspect.getsource(proxy.proxy_resource)
    assert "follow_redirects=False" in source
    assert "redirects are not allowed" in source.lower()
