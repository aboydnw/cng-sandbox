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
