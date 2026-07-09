def test_create_copc_connection(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "Autzen",
            "connection_type": "copc",
            "url": "https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz",
            "bounds": [-123.08, 44.05, -123.06, 44.06],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["connection_type"] == "copc"

    get_resp = client.get(f"/api/connections/{data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["bounds"] == [-123.08, 44.05, -123.06, 44.06]


def test_create_copc_connection_with_config(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "Autzen",
            "connection_type": "copc",
            "url": "https://example.com/a.copc.laz",
            "config": {"color_mode": "elevation", "point_size": 2.0},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["config"]["color_mode"] == "elevation"
