"""Security tests for /api/proxy endpoint."""

import socket
from typing import ClassVar


class FakeLargeResponse:
    status_code: ClassVar[int] = 200
    headers: ClassVar[dict[str, str]] = {}

    async def aiter_bytes(self, chunk_size=None):
        chunk = b"x" * (64 * 1024)
        for _ in range(1000):
            yield chunk

    async def aclose(self):
        pass


class FakeHttpxClient:
    def __init__(self, **kwargs):
        pass

    def build_request(self, method, url, headers=None):
        return None

    async def send(self, request, stream=False, **kwargs):
        return FakeLargeResponse()

    async def aclose(self):
        pass


def test_proxy_rejects_when_content_length_exceeds_cap(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeOversizedResponse:
        status_code: ClassVar[int] = 200
        headers: ClassVar[dict[str, str]] = {
            "content-length": str(60 * 1024 * 1024)
        }  # 60 MB

        async def aiter_bytes(self, chunk_size=None):
            return
            yield

        async def aclose(self):
            pass

    class FakeClientWithCL:
        def __init__(self, **kwargs):
            pass

        def build_request(self, method, url, headers=None):
            return None

        async def send(self, request, stream=False, **kwargs):
            return FakeOversizedResponse()

        async def aclose(self):
            pass

    monkeypatch.setattr("src.routes.proxy.httpx.AsyncClient", FakeClientWithCL)
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 413


def test_proxy_aborts_when_upstream_exceeds_byte_cap(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )
    monkeypatch.setattr("src.routes.proxy.httpx.AsyncClient", FakeHttpxClient)
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 413


def test_proxy_does_not_follow_redirects(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeRedirectResponse:
        status_code: ClassVar[int] = 301
        headers: ClassVar[dict[str, str]] = {
            "location": "https://169.254.169.254/latest/meta-data/"
        }

        async def aiter_bytes(self, chunk_size=None):
            return
            yield

        async def aclose(self):
            pass

    class FakeRedirectClient:
        def __init__(self, **kwargs):
            pass

        def build_request(self, method, url, headers=None):
            return None

        async def send(self, request, stream=False, **kwargs):
            return FakeRedirectResponse()

        async def aclose(self):
            pass

    monkeypatch.setattr("src.routes.proxy.httpx.AsyncClient", FakeRedirectClient)
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 502


def test_proxy_returns_502_on_dns_failure(client, monkeypatch):
    def raise_gaierror(*a, **kw):
        raise socket.gaierror("Name not resolved")

    monkeypatch.setattr("src.routes.proxy.socket.getaddrinfo", raise_gaierror)
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 502


def test_proxy_rejects_multicast_resolution(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("224.0.0.1", 0))],
    )
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 400


def test_proxy_rejects_unspecified_resolution(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("0.0.0.0", 0))],
    )
    resp = client.get("/api/proxy?url=https://example.com/file.pmtiles")
    assert resp.status_code == 400
