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
