def test_create_zarr_connection_round_trips_config(client):
    body = {
        "name": "ECMWF surface temp",
        "url": "https://data.source.coop/example/store.zarr",
        "connection_type": "zarr",
        "config": {
            "variable": "t2m",
            "timeDim": "time",
            "timeValues": ["2024-01-01T00:00:00Z", "2024-01-01T06:00:00Z"],
            "rescaleMin": 200.0,
            "rescaleMax": 320.0,
        },
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["connection_type"] == "zarr"
    assert data["config"]["variable"] == "t2m"
    assert data["config"]["timeValues"] == [
        "2024-01-01T00:00:00Z",
        "2024-01-01T06:00:00Z",
    ]

    get_resp = client.get(f"/api/connections/{data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["config"]["rescaleMin"] == 200.0


def test_create_zarr_connection_without_config_is_allowed(client):
    body = {
        "name": "minimal zarr",
        "url": "https://example.com/store.zarr",
        "connection_type": "zarr",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    assert resp.json()["config"] is None


def test_zarr_skips_cog_categorical_detection(client, monkeypatch):
    from src.routes import connections as connections_route

    def fail_if_called(path):
        raise AssertionError(
            f"detect_categories must not run for zarr connections; called with {path}"
        )

    monkeypatch.setattr(connections_route, "detect_categories", fail_if_called)

    body = {
        "name": "zarr",
        "url": "https://example.com/store.zarr",
        "connection_type": "zarr",
    }
    resp = client.post("/api/connections", json=body)
    assert resp.status_code == 201
    assert resp.json()["is_categorical"] is False
