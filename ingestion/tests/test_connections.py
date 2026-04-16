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
    from src.services.categorical import CategoricalResult, Category

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


def test_create_cog_connection_non_categorical_when_detection_fails(
    client, monkeypatch
):
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
    from src.services.categorical import CategoricalResult, Category

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


def test_create_geoparquet_connection(client):
    body = {
        "name": "Remote GeoParquet",
        "url": "https://example.com/data.parquet",
        "connection_type": "geoparquet",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["connection_type"] == "geoparquet"
    assert data["url"] == "https://example.com/data.parquet"
    assert data["id"]


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


def test_create_geoparquet_server_connection_enqueues_conversion(client, monkeypatch):
    from src.services import geoparquet_to_pmtiles

    calls = []

    def fake_run(conn_id, session):
        calls.append(conn_id)

    monkeypatch.setattr(geoparquet_to_pmtiles, "run_conversion", fake_run)

    resp = client.post(
        "/api/connections",
        json={
            "name": "Big parcels",
            "url": "https://example.com/parcels.parquet",
            "connection_type": "geoparquet",
            "render_path": "server",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["render_path"] == "server"
    assert body["conversion_status"] == "pending"
    assert body["tile_url"] is None
    assert calls == [body["id"]]


def test_create_geoparquet_client_connection_does_not_enqueue(client, monkeypatch):
    from src.services import geoparquet_to_pmtiles

    calls = []
    monkeypatch.setattr(
        geoparquet_to_pmtiles,
        "run_conversion",
        lambda cid, session: calls.append(cid),
    )

    resp = client.post(
        "/api/connections",
        json={
            "name": "Small parcels",
            "url": "https://example.com/parcels.parquet",
            "connection_type": "geoparquet",
            "render_path": "client",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["render_path"] == "client"
    assert body["conversion_status"] is None
    assert calls == []


def test_connection_row_has_conversion_fields(db_session):
    import uuid

    from src.models.connection import ConnectionRow

    row = ConnectionRow(
        id=str(uuid.uuid4()),
        name="t",
        url="https://example.com/a.parquet",
        connection_type="geoparquet",
        render_path="server",
        conversion_status="pending",
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.render_path == "server"
    assert row.conversion_status == "pending"
    assert row.tile_url is None
    assert row.conversion_error is None
    d = row.to_dict()
    assert d["render_path"] == "server"
    assert d["conversion_status"] == "pending"
    assert d["tile_url"] is None


def test_connection_conversion_stream_emits_terminal_event_when_ready(
    client, db_engine
):
    import uuid

    from sqlalchemy.orm import sessionmaker

    from src.models.connection import ConnectionRow

    Session = sessionmaker(bind=db_engine)
    s = Session()
    conn_id = str(uuid.uuid4())
    s.add(
        ConnectionRow(
            id=conn_id,
            name="t",
            url="https://example.com/x.parquet",
            connection_type="geoparquet",
            render_path="server",
            conversion_status="ready",
            tile_url="/pmtiles/connections/x/data.pmtiles",
            feature_count=42,
            workspace_id="testABCD",
        )
    )
    s.commit()
    s.close()

    with client.stream("GET", f"/api/connections/{conn_id}/stream") as r:
        assert r.status_code == 200
        text = "".join(chunk for chunk in r.iter_text())
    assert "event: status" in text
    assert '"status": "ready"' in text
    assert '"tile_url": "/pmtiles/connections/x/data.pmtiles"' in text


def test_connection_conversion_stream_returns_not_found_for_missing_row(client):
    with client.stream("GET", "/api/connections/does-not-exist/stream") as r:
        assert r.status_code == 200
        text = "".join(chunk for chunk in r.iter_text())
    assert '"status": "not_found"' in text


def test_create_geoparquet_without_render_path_defaults_to_server(client, monkeypatch):
    from src.routes import connections as connections_route

    async def fake_head(_url):
        return None

    monkeypatch.setattr(connections_route, "_head_content_length", fake_head)

    resp = client.post(
        "/api/connections",
        json={
            "name": "unknown",
            "url": "https://example.com/unknown.parquet",
            "connection_type": "geoparquet",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["render_path"] == "server"


def test_create_geoparquet_without_render_path_small_size_picks_client(
    client, monkeypatch
):
    from src.routes import connections as connections_route

    async def fake_head(_url):
        return 5 * 1024 * 1024

    monkeypatch.setattr(connections_route, "_head_content_length", fake_head)

    resp = client.post(
        "/api/connections",
        json={
            "name": "small",
            "url": "https://example.com/small.parquet",
            "connection_type": "geoparquet",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["render_path"] == "client"
