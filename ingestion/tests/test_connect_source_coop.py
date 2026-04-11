from unittest.mock import AsyncMock, patch

from starlette.testclient import TestClient

from src.services.enumerators import RemoteItem


def test_connect_source_coop_unknown_slug_returns_404(client):
    resp = client.post(
        "/api/connect-source-coop",
        json={"product_slug": "nobody/nothing"},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_connect_source_coop_requires_workspace(app):
    bare_client = TestClient(app, raise_server_exceptions=False)
    resp = bare_client.post(
        "/api/connect-source-coop",
        json={"product_slug": "alexgleith/gebco-2024"},
    )
    assert resp.status_code == 400


def test_connect_source_coop_happy_path_returns_dataset_id(client):
    fake_items = [
        RemoteItem(
            href="https://data.source.coop/alexgleith/gebco-2024/GEBCO_2024.tif",
            datetime=None,
            bbox=[-180.0, -90.0, 180.0, 90.0],
        )
    ]

    with (
        patch(
            "src.routes.connect_source_coop.run_enumerator",
            new=AsyncMock(return_value=fake_items),
        ),
        patch(
            "src.routes.connect_source_coop.register_remote_collection",
            new=AsyncMock(return_value="dataset-123"),
        ),
    ):
        resp = client.post(
            "/api/connect-source-coop",
            json={"product_slug": "alexgleith/gebco-2024"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["dataset_id"] == "dataset-123"
    assert "job_id" in body


def test_connect_source_coop_enumerator_failure_returns_502(client):
    with patch(
        "src.routes.connect_source_coop.run_enumerator",
        new=AsyncMock(side_effect=RuntimeError("source.coop unreachable")),
    ):
        resp = client.post(
            "/api/connect-source-coop",
            json={"product_slug": "alexgleith/gebco-2024"},
        )
    assert resp.status_code == 502
