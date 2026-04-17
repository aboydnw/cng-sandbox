"""Security tests for /api/proxy endpoint."""


class FakeLargeResponse:
    status_code = 200
    headers = {}

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

    async def send(self, request, stream=False):
        return FakeLargeResponse()

    async def aclose(self):
        pass


def test_proxy_rejects_when_content_length_exceeds_cap(client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.proxy.socket.getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 0))],
    )

    class FakeOversizedResponse:
        status_code = 200
        headers = {"content-length": str(60 * 1024 * 1024)}  # 60 MB

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

        async def send(self, request, stream=False):
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
