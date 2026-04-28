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
