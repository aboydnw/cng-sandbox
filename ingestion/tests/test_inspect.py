from unittest.mock import MagicMock


def test_inspect_url_detects_pmtiles(client, monkeypatch):
    fake_resp = MagicMock(status_code=200, headers={"content-length": "1234"})
    async def fake_head(self, url):
        return fake_resp
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)

    resp = client.post("/api/inspect-url", json={"url": "https://example.com/tiles.pmtiles"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "pmtiles"
    assert body["is_cog"] is False
    assert body["size_bytes"] == 1234
    assert body["has_errors"] is False


def test_inspect_url_detects_parquet(client, monkeypatch):
    fake_resp = MagicMock(status_code=200, headers={"content-length": "42"})
    async def fake_head(self, url):
        return fake_resp
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post("/api/inspect-url", json={"url": "https://example.com/data.parquet"})
    assert resp.status_code == 200
    assert resp.json()["format"] == "parquet"


def test_inspect_url_detects_cog(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post("/api/inspect-url", json={"url": "https://example.com/raster.cog"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "cog"
    assert body["is_cog"] is True


def test_inspect_url_detects_tiff(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post("/api/inspect-url", json={"url": "https://example.com/raster.tif"})
    assert resp.json()["format"] == "tiff"


def test_inspect_url_detects_xyz_template_without_head(client):
    resp = client.post(
        "/api/inspect-url",
        json={"url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "xyz"
    assert body["size_bytes"] is None
    assert body["has_errors"] is False


def test_inspect_url_unknown_extension_with_failed_head(client, monkeypatch):
    async def fake_head(self, url):
        raise RuntimeError("network down")
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post("/api/inspect-url", json={"url": "https://example.com/data/"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "unknown"
    assert body["has_errors"] is True
    assert body["error_detail"] is not None


def test_inspect_url_missing_url_returns_422(client):
    resp = client.post("/api/inspect-url", json={})
    assert resp.status_code == 422


def test_inspect_url_accepts_206_partial_content(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=206, headers={"content-length": "999"}, is_success=True)
    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post("/api/inspect-url", json={"url": "https://example.com/data.pmtiles"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_errors"] is False
    assert body["size_bytes"] == 999
