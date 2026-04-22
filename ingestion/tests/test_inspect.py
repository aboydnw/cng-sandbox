from unittest.mock import MagicMock

from src.services.cog_checker import CogCheckResult


def test_inspect_url_detects_pmtiles(client, monkeypatch):
    fake_resp = MagicMock(status_code=200, headers={"content-length": "1234"})

    async def fake_head(self, url):
        return fake_resp

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)

    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/tiles.pmtiles"}
    )
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
    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/data.parquet"}
    )
    assert resp.status_code == 200
    assert resp.json()["format"] == "parquet"


def test_inspect_url_detects_cog(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/raster.cog"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "cog"
    assert body["is_cog"] is True


def test_inspect_url_tiff_probed_as_cog(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})

    async def fake_probe(url):
        return CogCheckResult(is_cog=True, has_tiling=True, has_overviews=True)

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    monkeypatch.setattr("src.routes.inspect.check_remote_is_cog", fake_probe)

    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/raster.tif"}
    )
    body = resp.json()
    assert body["format"] == "tiff"
    assert body["is_cog"] is True


def test_inspect_url_tiff_probed_as_non_cog(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})

    async def fake_probe(url):
        return CogCheckResult(is_cog=False, has_tiling=False, has_overviews=False)

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    monkeypatch.setattr("src.routes.inspect.check_remote_is_cog", fake_probe)

    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/raster.tif"}
    )
    body = resp.json()
    assert body["format"] == "tiff"
    assert body["is_cog"] is False


def test_inspect_url_tiff_cog_probe_failure_falls_back(client, monkeypatch):
    async def fake_head(self, url):
        return MagicMock(status_code=200, headers={"content-length": "1"})

    async def fake_probe(url):
        raise RuntimeError("vsicurl connection refused")

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    monkeypatch.setattr("src.routes.inspect.check_remote_is_cog", fake_probe)

    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/raster.tif"}
    )
    body = resp.json()
    assert resp.status_code == 200
    assert body["format"] == "tiff"
    assert body["is_cog"] is False
    assert body["has_errors"] is False


def test_inspect_url_tiff_skips_cog_probe_when_head_fails(client, monkeypatch):
    async def fake_head(self, url):
        raise RuntimeError("network down")

    probe_called = {"value": False}

    async def fake_probe(url):
        probe_called["value"] = True
        return CogCheckResult(is_cog=True, has_tiling=True, has_overviews=True)

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    monkeypatch.setattr("src.routes.inspect.check_remote_is_cog", fake_probe)

    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/raster.tif"}
    )
    body = resp.json()
    assert body["format"] == "tiff"
    assert body["is_cog"] is False
    assert body["has_errors"] is True
    assert probe_called["value"] is False


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
        return MagicMock(
            status_code=206, headers={"content-length": "999"}, is_success=True
        )

    monkeypatch.setattr("httpx.AsyncClient.head", fake_head)
    resp = client.post(
        "/api/inspect-url", json={"url": "https://example.com/data.pmtiles"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_errors"] is False
    assert body["size_bytes"] == 999


def test_inspect_url_rejects_private_ip(client):
    resp = client.post(
        "/api/inspect-url", json={"url": "http://127.0.0.1/tiles.pmtiles"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "pmtiles"
    assert body["size_bytes"] is None
    assert body["has_errors"] is True
    assert (
        "private" in body["error_detail"].lower()
        or "loopback" in body["error_detail"].lower()
    )


def test_inspect_url_rejects_non_http_scheme(client):
    resp = client.post("/api/inspect-url", json={"url": "ftp://example.com/data.tif"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_errors"] is True
    assert "http" in body["error_detail"].lower()


def test_inspect_url_xyz_template_is_not_ssrf_checked(client):
    resp = client.post(
        "/api/inspect-url",
        json={"url": "http://127.0.0.1:8080/{z}/{x}/{y}.png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "xyz"
    assert body["has_errors"] is False
