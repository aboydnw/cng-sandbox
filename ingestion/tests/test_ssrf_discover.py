"""SSRF protection tests for discover and connect-remote endpoints."""


def test_discover_rejects_loopback(client):
    resp = client.post("/api/discover", json={"url": "http://127.0.0.1/listing"})
    assert resp.status_code == 422


def test_discover_rejects_private_ip(client):
    resp = client.post("/api/discover", json={"url": "http://10.0.0.1/listing"})
    assert resp.status_code == 422


def test_discover_rejects_metadata_endpoint(client):
    resp = client.post(
        "/api/discover",
        json={"url": "http://169.254.169.254/latest/meta-data/"},
    )
    assert resp.status_code == 422


def test_discover_allows_s3_scheme(client):
    # S3 scheme should pass validation (will fail on fetch, but not on validation)
    resp = client.post("/api/discover", json={"url": "s3://bucket/prefix/"})
    # 400 from fetch failure, not 422 from validation
    assert resp.status_code == 400


def test_connect_remote_rejects_private_url(client):
    resp = client.post(
        "/api/connect-remote",
        json={
            "url": "http://10.0.0.1/listing",
            "mode": "mosaic",
            "files": [{"url": "https://example.com/file.tif", "filename": "file.tif"}],
        },
    )
    assert resp.status_code == 422


def test_connect_remote_rejects_private_file_url(client):
    resp = client.post(
        "/api/connect-remote",
        json={
            "url": "https://example.com/listing",
            "mode": "mosaic",
            "files": [
                {"url": "http://169.254.169.254/secret", "filename": "secret.tif"}
            ],
        },
    )
    assert resp.status_code == 422
