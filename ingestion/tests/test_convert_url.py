from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.config import Settings


@pytest.fixture
def client():
    settings = Settings(
        s3_endpoint="http://fake:9000",
        stac_api_url="http://fake:8081",
        cors_origins=["*"],
    )
    app = create_app(settings=settings)
    with patch("src.app.boto3") as mock_boto3:
        mock_boto3.client.return_value = MagicMock()
        with TestClient(app) as c:
            yield c


def test_convert_url_rejects_file_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "file:///etc/passwd"})
    assert resp.status_code == 422


def test_convert_url_rejects_ftp_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "ftp://example.com/data.tif"})
    assert resp.status_code == 422


def test_convert_url_rejects_empty_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "/etc/passwd"})
    assert resp.status_code == 422


def test_convert_url_blocks_loopback():
    from src.routes.upload import ConvertUrlRequest

    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://127.0.0.1:9000/bucket/file.tif")


def test_convert_url_blocks_private_ip():
    from src.routes.upload import ConvertUrlRequest

    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://10.0.0.1/file.tif")


def test_convert_url_allows_public():
    from src.routes.upload import ConvertUrlRequest

    req = ConvertUrlRequest(url="https://example.com/file.tif")
    assert req.url == "https://example.com/file.tif"
