"""Tests for POST /api/validate-layer-config."""


def test_validate_layer_config_missing_dataset(client):
    resp = client.post(
        "/api/validate-layer-config",
        json={"dataset_id": "nonexistent-id", "colormap": "viridis"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert "error" in body


def test_validate_layer_config_missing_body(client):
    resp = client.post("/api/validate-layer-config", json={})
    assert resp.status_code == 422


def test_validate_layer_config_empty_colormap(client):
    resp = client.post(
        "/api/validate-layer-config",
        json={"dataset_id": "some-id", "colormap": ""},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert "error" in body


def test_validate_layer_config_color_mode_without_colormap(client, db_session):
    from src.models.dataset import DatasetRow

    ds = DatasetRow(
        id="ds-copc",
        filename="scan.copc.laz",
        dataset_type="pointcloud",
        format_pair="las-to-copc",
        tile_url="/storage/datasets/ds-copc/converted/data.copc.laz",
        workspace_id="testABCD",
    )
    db_session.add(ds)
    db_session.commit()

    resp = client.post(
        "/api/validate-layer-config",
        json={"dataset_id": "ds-copc", "color_mode": "elevation"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_validate_layer_config_valid_dataset(client, db_session):
    from src.models.dataset import DatasetRow

    ds = DatasetRow(
        id="ds-abc123",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff-cog",
        tile_url="/cog/tiles/{z}/{x}/{y}.png",
        workspace_id="testABCD",
    )
    db_session.add(ds)
    db_session.commit()

    resp = client.post(
        "/api/validate-layer-config",
        json={"dataset_id": "ds-abc123", "colormap": "viridis"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
