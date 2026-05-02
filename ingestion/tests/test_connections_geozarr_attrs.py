"""POST + PATCH paths for the geozarr_attrs override field."""

from starlette.testclient import TestClient

GOOD_ATTRS = {
    "spatial:dimensions": ["latitude", "longitude"],
    "spatial:transform": [0.1, 0, -180, 0, -0.1, 90],
    "spatial:shape": [1800, 3600],
    "proj:code": "EPSG:4326",
}


def test_post_accepts_geozarr_attrs(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/x.zarr",
            "connection_type": "zarr",
            "geozarr_attrs": GOOD_ATTRS,
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["geozarr_attrs"] == GOOD_ATTRS


def test_post_rejects_malformed_geozarr_attrs(client):
    bad = {**GOOD_ATTRS, "proj:code": "not-an-epsg"}
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/x.zarr",
            "connection_type": "zarr",
            "geozarr_attrs": bad,
        },
    )
    assert resp.status_code == 422


def test_post_rejects_geozarr_attrs_on_non_zarr(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/x.tif",
            "connection_type": "cog",
            "geozarr_attrs": GOOD_ATTRS,
        },
    )
    assert resp.status_code == 422


def test_post_omits_geozarr_attrs(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/x.zarr",
            "connection_type": "zarr",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["geozarr_attrs"] is None


def _create_zarr(client) -> str:
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/x.zarr",
            "connection_type": "zarr",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_patch_sets_geozarr_attrs(client):
    cid = _create_zarr(client)
    resp = client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": GOOD_ATTRS},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["geozarr_attrs"] == GOOD_ATTRS


def test_patch_clears_geozarr_attrs(client):
    cid = _create_zarr(client)
    set_resp = client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": GOOD_ATTRS},
    )
    assert set_resp.status_code == 200, set_resp.text
    assert set_resp.json()["geozarr_attrs"] == GOOD_ATTRS
    resp = client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": None},
    )
    assert resp.status_code == 200
    assert resp.json()["geozarr_attrs"] is None


def test_patch_rejects_malformed(client):
    cid = _create_zarr(client)
    bad = {**GOOD_ATTRS, "proj:code": "WGS84"}
    resp = client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": bad},
    )
    assert resp.status_code == 422


def test_patch_rejects_non_zarr_connection(client):
    resp = client.post(
        "/api/connections",
        json={
            "name": "x",
            "url": "https://example.com/tiles/{z}/{x}/{y}.png",
            "connection_type": "xyz_raster",
        },
    )
    cid = resp.json()["id"]
    resp = client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": GOOD_ATTRS},
    )
    assert resp.status_code == 400


def test_patch_rejects_other_workspace(client, app):
    cid = _create_zarr(client)
    other_client = TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-Workspace-Id": "otherWS1"},
    )
    resp = other_client.patch(
        f"/api/connections/{cid}/geozarr-attrs",
        json={"geozarr_attrs": GOOD_ATTRS},
    )
    assert resp.status_code == 403


def test_patch_rejects_example_connection(client, db_session):
    from src.models.connection import ConnectionRow

    db_session.add(
        ConnectionRow(
            id="seeded-zarr-attrs-test",
            name="curated zarr",
            url="https://example.org/curated.zarr",
            connection_type="zarr",
            workspace_id=None,
            is_example=True,
        )
    )
    db_session.commit()
    resp = client.patch(
        "/api/connections/seeded-zarr-attrs-test/geozarr-attrs",
        json={"geozarr_attrs": GOOD_ATTRS},
    )
    assert resp.status_code == 403
