import io

from fastapi.testclient import TestClient
from PIL import Image


def _png_bytes(width: int = 1200, height: int = 800) -> bytes:
    img = Image.new("RGB", (width, height), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_upload_image_happy_path(client: TestClient, monkeypatch):
    calls = []

    def fake_put_object(key, body, content_type):
        calls.append(key)
        return f"https://r2.example/{key}"

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)

    files = {"file": ("photo.png", _png_bytes(), "image/png")}
    data = {"kind": "image"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["mime"] in ("image/jpeg", "image/png")
    assert body["thumbnail_url"]
    assert body["width"] > 0
    assert body["height"] > 0
    assert len(calls) == 2  # original + thumbnail


def test_upload_image_rejects_oversize(client: TestClient):
    big = b"\0" * (26 * 1024 * 1024)
    files = {"file": ("big.bin", big, "image/jpeg")}
    data = {"kind": "image"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 413


def test_upload_image_rejects_wrong_mime(client: TestClient):
    files = {"file": ("photo.gif", b"GIF89a", "image/gif")}
    data = {"kind": "image"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 415


def test_upload_image_rejects_non_image_bytes(client: TestClient):
    files = {"file": ("evil.png", b"definitely not a png", "image/png")}
    data = {"kind": "image"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 400


def test_get_story_asset_returns_metadata(client, monkeypatch):
    def fake_put_object(key, body, content_type):
        pass

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("a.png", _png_bytes(), "image/png")},
        data={"kind": "image"},
    )
    assert upload.status_code == 201
    asset_id = upload.json()["asset_id"]

    resp = client.get(f"/api/story-assets/{asset_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["asset_id"] == asset_id
    assert body["kind"] == "image"
    assert body["thumbnail_url"]


def test_delete_story_asset_removes_row_and_objects(client, monkeypatch):
    calls = []
    deleted = []

    def fake_put_object(key, body, content_type):
        calls.append(key)

    def fake_delete_object(key):
        deleted.append(key)

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)
    monkeypatch.setattr("src.routes.story_assets._delete_object", fake_delete_object)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("a.png", _png_bytes(), "image/png")},
        data={"kind": "image"},
    )
    assert upload.status_code == 201
    asset_id = upload.json()["asset_id"]

    resp = client.delete(f"/api/story-assets/{asset_id}")
    assert resp.status_code == 204
    assert len(deleted) == 2  # original + thumbnail

    resp = client.get(f"/api/story-assets/{asset_id}")
    assert resp.status_code == 404


def test_upload_csv_happy_path(client: TestClient, monkeypatch):
    calls = []

    def fake_put_object(key, body, content_type):
        calls.append(key)
        return f"https://r2.example/{key}"

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)

    csv = b"date,value\n2020-01-01,1.5\n2020-02-01,2.0\n2020-03-01,2.5\n"
    files = {"file": ("series.csv", csv, "text/csv")}
    data = {"kind": "csv"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["mime"] == "text/csv"
    assert body["columns"] == ["date", "value"]
    assert body["row_count"] == 3
    assert len(calls) == 1


def test_upload_csv_rejects_oversize(client: TestClient):
    big = b"a,b\n" + b"1,2\n" * 2_000_000
    files = {"file": ("big.csv", big, "text/csv")}
    data = {"kind": "csv"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 413


def test_upload_csv_rejects_malformed(client: TestClient):
    files = {"file": ("bad.csv", b"\xff\xfe\x00not csv", "text/csv")}
    data = {"kind": "csv"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 400


def test_upload_csv_rejects_non_csv_mime(client: TestClient):
    csv = b"date,value\n2020-01-01,1.5\n"
    files = {"file": ("data.csv", csv, "application/pdf")}
    data = {"kind": "csv"}
    resp = client.post("/api/story-assets", files=files, data=data)
    assert resp.status_code == 415


def test_get_story_asset_data_streams_bytes(client, monkeypatch):
    csv = b"date,value\n2020-01-01,1.5\n2020-02-01,2.0\n"
    stored = {}

    def fake_put_object(key, body, content_type):
        stored[key] = body

    class FakeGetResult:
        def __init__(self, data):
            self._data = data

        def bytes(self):
            return self._data

    def fake_obstore_get(store, key):
        return FakeGetResult(stored[key])

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)
    monkeypatch.setattr("src.routes.story_assets.obstore.get", fake_obstore_get)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("series.csv", csv, "text/csv")},
        data={"kind": "csv"},
    )
    assert upload.status_code == 201
    asset_id = upload.json()["asset_id"]

    resp = client.get(f"/api/story-assets/{asset_id}/data")
    assert resp.status_code == 200
    assert resp.content == csv
    assert resp.headers["content-type"].startswith("text/csv")


def test_get_story_asset_data_blocks_other_workspace(client, app, monkeypatch):
    csv = b"date,value\n2020-01-01,1.5\n"
    stored = {}

    def fake_put_object(key, body, content_type):
        stored[key] = body

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("a.csv", csv, "text/csv")},
        data={"kind": "csv"},
    )
    asset_id = upload.json()["asset_id"]

    other = TestClient(
        app, raise_server_exceptions=False, headers={"X-Workspace-Id": "otherABCD"}
    )
    resp = other.get(f"/api/story-assets/{asset_id}/data")
    assert resp.status_code == 404


def test_get_story_asset_data_404_when_missing(client):
    resp = client.get("/api/story-assets/00000000-0000-0000-0000-000000000000/data")
    assert resp.status_code == 404


def test_get_story_asset_data_502_on_storage_failure(client, monkeypatch):
    csv = b"date,value\n2020-01-01,1.5\n"

    def fake_put_object(key, body, content_type):
        pass

    def fake_obstore_get(store, key):
        raise RuntimeError("R2 down")

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)
    monkeypatch.setattr("src.routes.story_assets.obstore.get", fake_obstore_get)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("a.csv", csv, "text/csv")},
        data={"kind": "csv"},
    )
    asset_id = upload.json()["asset_id"]

    resp = client.get(f"/api/story-assets/{asset_id}/data")
    assert resp.status_code == 502


def test_get_story_asset_data_404_when_object_missing(client, monkeypatch):
    csv = b"date,value\n2020-01-01,1.5\n"

    def fake_put_object(key, body, content_type):
        pass

    def fake_obstore_get(store, key):
        raise FileNotFoundError(key)

    monkeypatch.setattr("src.routes.story_assets._put_object", fake_put_object)
    monkeypatch.setattr("src.routes.story_assets.obstore.get", fake_obstore_get)

    upload = client.post(
        "/api/story-assets",
        files={"file": ("a.csv", csv, "text/csv")},
        data={"kind": "csv"},
    )
    asset_id = upload.json()["asset_id"]

    resp = client.get(f"/api/story-assets/{asset_id}/data")
    assert resp.status_code == 404


def test_public_url_raises_when_env_unset(monkeypatch):
    from src.routes.story_assets import _public_url

    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    try:
        _public_url("some/key")
    except RuntimeError as exc:
        assert "R2_PUBLIC_URL" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


def test_public_url_returns_absolute_when_env_set(monkeypatch):
    from src.routes.story_assets import _public_url

    monkeypatch.setenv("R2_PUBLIC_URL", "https://r2.example/")
    assert _public_url("a/b.csv") == "https://r2.example/a/b.csv"


def test_put_object_validates_env_before_upload(monkeypatch):
    import src.routes.story_assets as story_assets_mod

    upload_called = False

    def fake_put(*args, **kwargs):
        nonlocal upload_called
        upload_called = True

    monkeypatch.setattr(story_assets_mod.obstore, "put", fake_put)
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)

    try:
        story_assets_mod._put_object("some/key", b"x", "text/csv")
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected RuntimeError")
    assert not upload_called, "upload must not happen when R2_PUBLIC_URL is unset"
