def test_list_connections_empty(client):
    resp = client.get("/api/connections")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_connection(client):
    body = {
        "name": "Test COG",
        "url": "https://example.com/data.tif",
        "connection_type": "cog",
        "bounds": [-122.5, 37.5, -122.0, 38.0],
        "min_zoom": 0,
        "max_zoom": 18,
        "tile_type": "raster",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test COG"
    assert data["connection_type"] == "cog"
    assert data["bounds"] == [-122.5, 37.5, -122.0, 38.0]
    assert data["workspace_id"] == "testABCD"

    get_resp = client.get(f"/api/connections/{data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == data["id"]


def test_create_connection_invalid_type(client):
    body = {
        "name": "Bad",
        "url": "https://example.com/data.tif",
        "connection_type": "invalid",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 422


def test_delete_connection(client):
    body = {
        "name": "To Delete",
        "url": "https://example.com/tiles/{z}/{x}/{y}.png",
        "connection_type": "xyz_raster",
    }
    resp = client.post("/api/connections", json=body)
    conn_id = resp.json()["id"]

    del_resp = client.delete(f"/api/connections/{conn_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/connections/{conn_id}")
    assert get_resp.status_code == 404


def test_list_connections_workspace_isolation(client, app):
    from starlette.testclient import TestClient

    body = {
        "name": "WS1 Connection",
        "url": "https://example.com/data.tif",
        "connection_type": "cog",
    }
    client.post("/api/connections", json=body)

    other_client = TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-Workspace-Id": "otherWS1"},
    )
    resp = other_client.get("/api/connections")
    assert resp.status_code == 200
    assert resp.json() == []


def test_delete_connection_wrong_workspace(client, app):
    from starlette.testclient import TestClient

    body = {
        "name": "Protected",
        "url": "https://example.com/data.pmtiles",
        "connection_type": "pmtiles",
    }
    resp = client.post("/api/connections", json=body)
    conn_id = resp.json()["id"]

    other_client = TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-Workspace-Id": "otherWS1"},
    )
    del_resp = other_client.delete(f"/api/connections/{conn_id}")
    assert del_resp.status_code == 403


def test_create_connection_minimal_fields(client):
    body = {
        "name": "XYZ Tiles",
        "url": "https://tiles.example.com/{z}/{x}/{y}.png",
        "connection_type": "xyz_raster",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["bounds"] is None
    assert data["min_zoom"] is None
    assert data["max_zoom"] is None
    assert data["tile_type"] is None


def test_get_connection_not_found(client):
    resp = client.get("/api/connections/nonexistent-id")
    assert resp.status_code == 404


def test_create_cog_connection_detects_categorical(client, monkeypatch):
    from src.routes import connections as connections_route
    from src.services.categorical import Category, CategoricalResult

    def fake_detect(path):
        assert path.startswith("/vsicurl/")
        return CategoricalResult(
            is_categorical=True,
            categories=[
                Category(value=1, color="#AA0000", label="Class 1"),
                Category(value=2, color="#00AA00", label="Class 2"),
            ],
        )

    monkeypatch.setattr(connections_route, "detect_categories", fake_detect)

    body = {
        "name": "LandCover",
        "url": "https://example.com/landcover.tif",
        "connection_type": "cog",
        "tile_type": "raster",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_categorical"] is True
    assert data["categories"] == [
        {"value": 1, "color": "#AA0000", "label": "Class 1"},
        {"value": 2, "color": "#00AA00", "label": "Class 2"},
    ]


def test_create_cog_connection_non_categorical_when_detection_fails(client, monkeypatch):
    from src.routes import connections as connections_route

    def boom(path):
        raise RuntimeError("network down")

    monkeypatch.setattr(connections_route, "detect_categories", boom)

    body = {
        "name": "Continuous",
        "url": "https://example.com/dem.tif",
        "connection_type": "cog",
        "tile_type": "raster",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_categorical"] is False
    assert data["categories"] is None


def test_patch_connection_categories_updates_labels(client, monkeypatch):
    from src.routes import connections as connections_route
    from src.services.categorical import Category, CategoricalResult

    monkeypatch.setattr(
        connections_route,
        "detect_categories",
        lambda path: CategoricalResult(
            is_categorical=True,
            categories=[
                Category(value=1, color="#AA0000", label="A"),
                Category(value=2, color="#00AA00", label="B"),
            ],
        ),
    )

    resp = client.post(
        "/api/connections",
        json={
            "name": "LC",
            "url": "https://example.com/lc.tif",
            "connection_type": "cog",
        },
    )
    conn_id = resp.json()["id"]

    patch_resp = client.patch(
        f"/api/connections/{conn_id}/categories",
        json=[{"value": 1, "label": "Forest"}, {"value": 2, "label": "Water"}],
    )
    assert patch_resp.status_code == 200
    cats = patch_resp.json()
    labels = {c["value"]: c["label"] for c in cats}
    assert labels == {1: "Forest", 2: "Water"}

    # Re-fetch to confirm persistence
    get_resp = client.get(f"/api/connections/{conn_id}")
    assert get_resp.json()["categories"][0]["label"] == "Forest"


def test_patch_connection_categories_rejects_non_categorical(client):
    body = {
        "name": "Plain",
        "url": "https://tiles.example.com/{z}/{x}/{y}.png",
        "connection_type": "xyz_raster",
    }
    resp = client.post("/api/connections", json=body)
    conn_id = resp.json()["id"]

    patch_resp = client.patch(
        f"/api/connections/{conn_id}/categories",
        json=[{"value": 1, "label": "X"}],
    )
    assert patch_resp.status_code == 400
