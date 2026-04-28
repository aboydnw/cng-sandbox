import io
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient


def _png_bytes(width: int = 1200, height: int = 800) -> bytes:
    img = Image.new("RGB", (width, height), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_upload_image_happy_path(client: TestClient):
    with patch("src.routes.story_assets._put_object") as mock_put:
        mock_put.return_value = "https://r2.example/abc"
        files = {"file": ("photo.png", _png_bytes(), "image/png")}
        data = {"kind": "image"}
        resp = client.post("/api/story-assets", files=files, data=data)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["mime"] in ("image/jpeg", "image/png")
        assert body["thumbnail_url"]
        assert body["width"] > 0
        assert body["height"] > 0
        assert mock_put.call_count == 2  # original + thumbnail


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
