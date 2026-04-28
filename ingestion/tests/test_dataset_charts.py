"""Tests for the dataset timeseries endpoint."""

from unittest.mock import patch

import pytest

from src.routes.dataset_charts import _cached_complete_timeseries


@pytest.fixture(autouse=True)
def clear_timeseries_cache():
    _cached_complete_timeseries.cache_clear()
    yield
    _cached_complete_timeseries.cache_clear()


def test_timeseries_returns_value_per_timestep(client):
    with (
        patch("src.routes.dataset_charts._titiler_point") as mock_pt,
        patch("src.routes.dataset_charts._load_dataset") as mock_load,
    ):
        mock_load.return_value = {
            "id": "ds-1",
            "is_temporal": True,
            "timesteps": [
                {"datetime": "2020-01-01T00:00:00Z"},
                {"datetime": "2020-02-01T00:00:00Z"},
                {"datetime": "2020-03-01T00:00:00Z"},
            ],
            "stac_collection_id": "col",
        }
        mock_pt.side_effect = [1.0, 2.5, 3.0]

        resp = client.get("/api/datasets/ds-1/timeseries", params={"lon": 0, "lat": 0})
        assert resp.status_code == 200
        body = resp.json()
        assert body == [
            {"datetime": "2020-01-01T00:00:00Z", "value": 1.0},
            {"datetime": "2020-02-01T00:00:00Z", "value": 2.5},
            {"datetime": "2020-03-01T00:00:00Z", "value": 3.0},
        ]


def test_timeseries_rejects_non_temporal(client):
    with patch("src.routes.dataset_charts._load_dataset") as mock_load:
        mock_load.return_value = {"id": "ds-1", "is_temporal": False, "timesteps": []}
        resp = client.get("/api/datasets/ds-1/timeseries", params={"lon": 0, "lat": 0})
        assert resp.status_code == 400


def test_titiler_point_parses_scalar_values(monkeypatch):
    from src.routes.dataset_charts import _titiler_point

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"values": [42.5]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr("src.routes.dataset_charts.httpx.Client", FakeClient)
    assert _titiler_point("col", "2020-01-01", 0.0, 0.0) == 42.5


def test_titiler_point_parses_nested_list_values(monkeypatch):
    from src.routes.dataset_charts import _titiler_point

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"values": [[1.5, 2.5]]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr("src.routes.dataset_charts.httpx.Client", FakeClient)
    assert _titiler_point("col", "2020-01-01", 0.0, 0.0) == 1.5


def test_titiler_point_returns_none_on_empty_values(monkeypatch):
    from src.routes.dataset_charts import _titiler_point

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"values": []}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr("src.routes.dataset_charts.httpx.Client", FakeClient)
    assert _titiler_point("col", "2020-01-01", 0.0, 0.0) is None


def test_titiler_point_returns_none_on_non_200(monkeypatch, caplog):
    import logging

    from src.routes.dataset_charts import _titiler_point

    class FakeResponse:
        status_code = 500
        text = "Internal Server Error"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def get(self, url, params=None):
            return FakeResponse()

    monkeypatch.setattr("src.routes.dataset_charts.httpx.Client", FakeClient)
    with caplog.at_level(logging.WARNING, logger="src.routes.dataset_charts"):
        result = _titiler_point("col", "2020-01-01", 0.0, 0.0)
    assert result is None
    assert any("500" in record.message for record in caplog.records)


def test_histogram_continuous_returns_numeric_bins(client: pytest.fixture):
    with (
        patch("src.routes.dataset_charts._titiler_statistics") as mock_stats,
        patch("src.routes.dataset_charts._load_dataset") as mock_load,
    ):
        mock_load.return_value = {
            "id": "ds-1",
            "is_temporal": False,
            "is_categorical": False,
            "categories": None,
            "stac_collection_id": "col",
        }
        mock_stats.return_value = {
            "histogram": [[10, 20, 30], [0, 5, 10]],  # [counts, edges]
        }
        resp = client.get("/api/datasets/ds-1/histogram", params={"bins": 3})
        assert resp.status_code == 200
        body = resp.json()
        assert body == [
            {"bin_min": 0, "bin_max": 5, "count": 10},
            {"bin_min": 5, "bin_max": 10, "count": 20},
            {"bin_min": 10, "bin_max": 10, "count": 30},
        ]


def test_histogram_categorical_returns_class_counts(client: pytest.fixture):
    with (
        patch("src.routes.dataset_charts._titiler_statistics") as mock_stats,
        patch("src.routes.dataset_charts._load_dataset") as mock_load,
    ):
        mock_load.return_value = {
            "id": "ds-1",
            "is_temporal": False,
            "is_categorical": True,
            "categories": [
                {"value": 1, "color": "#ff0000", "label": "forest"},
                {"value": 2, "color": "#00ff00", "label": "water"},
            ],
            "stac_collection_id": "col",
        }
        mock_stats.return_value = {"categorical": {"1": 100, "2": 50}}
        resp = client.get("/api/datasets/ds-1/histogram")
        assert resp.status_code == 200
        body = resp.json()
        assert body == [
            {"class": 1, "label": "forest", "count": 100},
            {"class": 2, "label": "water", "count": 50},
        ]
