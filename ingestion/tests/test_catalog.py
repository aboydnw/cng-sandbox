import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.middleware.rate_limit import catalog_rate_limiter


def test_list_providers(client):
    resp = client.get("/api/catalog/providers")
    assert resp.status_code == 200
    providers = resp.json()
    assert len(providers) >= 1
    earth = next(p for p in providers if p["id"] == "earth-search")
    assert earth["name"] == "Earth Search"


@patch("src.routes.catalog.httpx.AsyncClient")
def test_list_collections(mock_client_class, client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "collections": [
            {"id": "sentinel-2-l2a", "title": "Sentinel-2 L2A", "description": "..."}
        ]
    }
    mock_instance = AsyncMock()
    mock_instance.get.return_value = mock_response
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=False)
    mock_client_class.return_value = mock_instance

    resp = client.get("/api/catalog/earth-search/collections")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["collections"]) == 1


def test_list_collections_unknown_provider(client):
    resp = client.get("/api/catalog/nonexistent/collections")
    assert resp.status_code == 404


@patch("src.routes.catalog.httpx.AsyncClient")
def test_search_items(mock_client_class, client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "S2B_32TQM_20240315",
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[]]},
                "properties": {"datetime": "2024-03-15T00:00:00Z", "eo:cloud_cover": 8},
                "assets": {"visual": {"href": "https://example.com/cog.tif"}},
            }
        ],
        "context": {"matched": 42},
    }
    mock_instance = AsyncMock()
    mock_instance.post.return_value = mock_response
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=False)
    mock_client_class.return_value = mock_instance

    resp = client.post("/api/catalog/earth-search/search", json={
        "collections": ["sentinel-2-l2a"],
        "bbox": [-122.5, 37.5, -122.0, 38.0],
        "datetime": "2024-01-01T00:00:00Z/2024-12-31T23:59:59Z",
        "limit": 20,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["features"]) == 1


def test_rate_limit_on_search(client):
    catalog_rate_limiter.reset()

    with patch("src.routes.catalog.httpx.AsyncClient") as mock_client_class:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"type": "FeatureCollection", "features": []}
        mock_instance = AsyncMock()
        mock_instance.post.return_value = mock_response
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_client_class.return_value = mock_instance

        for i in range(60):
            resp = client.post("/api/catalog/earth-search/search", json={
                "collections": ["sentinel-2-l2a"], "limit": 1,
            })
            assert resp.status_code == 200, f"Request {i+1} failed"

        resp = client.post("/api/catalog/earth-search/search", json={
            "collections": ["sentinel-2-l2a"], "limit": 1,
        })
        assert resp.status_code == 429
