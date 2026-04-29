from typing import ClassVar


class FakeBytesResponse:
    status_code: ClassVar[int] = 200
    headers: ClassVar[dict[str, str]] = {
        "content-type": "application/octet-stream",
        "content-length": "5",
    }

    async def aiter_bytes(self, chunk_size=None):
        yield b"chunk"

    async def aclose(self):
        pass


class FakeOkClient:
    def __init__(self, **kwargs):
        pass

    def build_request(self, method, url, headers=None):
        return None

    async def send(self, request, stream=False, **kwargs):
        return FakeBytesResponse()

    async def aclose(self):
        pass


def test_zarr_proxy_streams_body(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )
    monkeypatch.setattr("src.routes.zarr_proxy.httpx.AsyncClient", FakeOkClient)

    resp = client.get("/api/zarr-proxy?url=https://example.com/store.zarr/zarr.json")
    assert resp.status_code == 200
    assert resp.content == b"chunk"
    assert resp.headers["content-type"] == "application/octet-stream"


def test_zarr_proxy_rejects_non_https(client):
    resp = client.get("/api/zarr-proxy?url=http://example.com/store.zarr/zarr.json")
    assert resp.status_code == 400


def test_zarr_proxy_rejects_private_resolution(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("10.0.0.1", 0))],
    )
    resp = client.get(
        "/api/zarr-proxy?url=https://attacker.example.com/store.zarr/zarr.json"
    )
    assert resp.status_code == 400


class FakeRangeResponse:
    status_code: ClassVar[int] = 206
    headers: ClassVar[dict[str, str]] = {
        "content-type": "application/octet-stream",
        "content-range": "bytes 0-3/100",
        "content-length": "4",
    }
    received_range: ClassVar[str | None] = None

    async def aiter_bytes(self, chunk_size=None):
        yield b"abcd"

    async def aclose(self):
        pass


class FakeRangeClient:
    last_range: ClassVar[str | None] = None

    def __init__(self, **kwargs):
        pass

    def build_request(self, method, url, headers=None):
        return None

    async def send(self, request, stream=False, **kwargs):
        FakeRangeClient.last_range = request.headers.get("range")
        return FakeRangeResponse()

    async def aclose(self):
        pass


def test_zarr_proxy_forwards_range_header(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )
    monkeypatch.setattr("src.routes.zarr_proxy.httpx.AsyncClient", FakeRangeClient)

    resp = client.get(
        "/api/zarr-proxy?url=https://example.com/store.zarr/0.0.0",
        headers={"range": "bytes=0-3"},
    )
    assert resp.status_code == 206
    assert resp.headers["content-range"] == "bytes 0-3/100"
    assert resp.headers["accept-ranges"] == "bytes"
    assert FakeRangeClient.last_range == "bytes=0-3"


def test_zarr_proxy_rejects_redirect(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeRedirectResponse:
        status_code: ClassVar[int] = 301
        headers: ClassVar[dict[str, str]] = {
            "location": "https://169.254.169.254/latest/meta-data/",
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

    monkeypatch.setattr("src.routes.zarr_proxy.httpx.AsyncClient", FakeRedirectClient)
    resp = client.get("/api/zarr-proxy?url=https://example.com/store.zarr/zarr.json")
    assert resp.status_code == 502


def test_zarr_proxy_rejects_oversized_content_length(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeOversizedResponse:
        status_code: ClassVar[int] = 200
        headers: ClassVar[dict[str, str]] = {
            "content-length": str(60 * 1024 * 1024),
        }

        async def aiter_bytes(self, chunk_size=None):
            return
            yield

        async def aclose(self):
            pass

    class FakeOversizedClient:
        def __init__(self, **kwargs):
            pass

        def build_request(self, method, url, headers=None):
            return None

        async def send(self, request, stream=False, **kwargs):
            return FakeOversizedResponse()

        async def aclose(self):
            pass

    monkeypatch.setattr("src.routes.zarr_proxy.httpx.AsyncClient", FakeOversizedClient)
    resp = client.get("/api/zarr-proxy?url=https://example.com/store.zarr/0.0.0")
    assert resp.status_code == 413


def test_zarr_proxy_aborts_when_streamed_body_exceeds_cap(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.zarr_proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeBigResponse:
        status_code: ClassVar[int] = 200
        headers: ClassVar[dict[str, str]] = {}

        async def aiter_bytes(self, chunk_size=None):
            chunk = b"x" * (64 * 1024)
            for _ in range(1000):
                yield chunk

        async def aclose(self):
            pass

    class FakeBigClient:
        def __init__(self, **kwargs):
            pass

        def build_request(self, method, url, headers=None):
            return None

        async def send(self, request, stream=False, **kwargs):
            return FakeBigResponse()

        async def aclose(self):
            pass

    monkeypatch.setattr("src.routes.zarr_proxy.httpx.AsyncClient", FakeBigClient)
    resp = client.get("/api/zarr-proxy?url=https://example.com/store.zarr/0.0.0")
    assert resp.status_code == 413
