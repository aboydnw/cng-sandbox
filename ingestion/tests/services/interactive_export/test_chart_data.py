from unittest.mock import MagicMock

import pytest

from src.services.interactive_export import chart_data


def test_resolves_csv_url(monkeypatch):
    monkeypatch.setattr(
        "src.services.interactive_export.builder._fetch_csv_rows",
        lambda url: [{"year": 2020, "v": 1.0}],
    )
    payload = chart_data.resolve(
        raw_chapter={
            "type": "chart",
            "chart": {
                "source": {"kind": "csv", "url": "https://example.com/x.csv"},
                "viz": {},
            },
        },
        session=MagicMock(),
        workspace_id="ws1",
    )
    assert payload == {"kind": "csv_rows", "rows": [{"year": 2020, "v": 1.0}]}


def test_resolves_csv_asset(monkeypatch):
    csv_content = "year,v\n2020,1.5\n2021,2.5\n"
    monkeypatch.setattr(
        chart_data,
        "_read_story_asset_csv",
        lambda session, ws, asset_id: csv_content,
    )
    payload = chart_data.resolve(
        raw_chapter={
            "type": "chart",
            "chart": {
                "source": {"kind": "csv", "asset_id": "a1"},
                "viz": {},
            },
        },
        session=MagicMock(),
        workspace_id="ws1",
    )
    assert payload["kind"] == "csv_rows"
    assert payload["rows"] == [
        {"year": 2020, "v": 1.5},
        {"year": 2021, "v": 2.5},
    ]


def test_resolves_dataset_timeseries(monkeypatch):
    monkeypatch.setattr(
        "src.routes.dataset_charts.load_dataset",
        lambda session, dataset_id, ws: {
            "is_temporal": True,
            "timesteps": [
                {"datetime": "2020-01-01"},
                {"datetime": "2021-01-01"},
            ],
            "stac_collection_id": "coll-1",
        },
    )
    monkeypatch.setattr(
        "src.routes.dataset_charts.cached_timeseries",
        lambda dataset_id, collection_id, lon, lat, datetimes: (
            ("2020-01-01", 1.0),
            ("2021-01-01", 2.0),
        ),
    )
    payload = chart_data.resolve(
        raw_chapter={
            "type": "chart",
            "chart": {
                "source": {
                    "kind": "dataset_timeseries",
                    "dataset_id": "ds1",
                    "point": [10.0, 20.0],
                },
                "viz": {},
            },
        },
        session=MagicMock(),
        workspace_id="ws1",
    )
    assert payload == {
        "kind": "timeseries_points",
        "points": [
            {"datetime": "2020-01-01", "value": 1.0},
            {"datetime": "2021-01-01", "value": 2.0},
        ],
    }


def test_resolves_dataset_histogram(monkeypatch):
    monkeypatch.setattr(
        "src.routes.dataset_charts.load_dataset",
        lambda session, dataset_id, ws: {
            "is_categorical": False,
            "stac_collection_id": "coll-1",
        },
    )
    monkeypatch.setattr(
        "src.routes.dataset_charts.titiler_statistics",
        lambda collection_id, *, categorical, bins: {
            "histogram": [
                [3, 7, 4],
                [0.0, 1.0, 2.0, 3.0],
            ],
        },
    )
    payload = chart_data.resolve(
        raw_chapter={
            "type": "chart",
            "chart": {
                "source": {
                    "kind": "dataset_histogram",
                    "dataset_id": "ds1",
                    "bins": 3,
                },
                "viz": {},
            },
        },
        session=MagicMock(),
        workspace_id="ws1",
    )
    assert payload["kind"] == "histogram_bins"
    assert payload["bins"] == [
        {"bin_min": 0.0, "bin_max": 1.0, "count": 3},
        {"bin_min": 1.0, "bin_max": 2.0, "count": 7},
        {"bin_min": 2.0, "bin_max": 3.0, "count": 4},
    ]


def test_unknown_kind_raises():
    with pytest.raises(ValueError, match="bogus"):
        chart_data.resolve(
            raw_chapter={
                "type": "chart",
                "chart": {"source": {"kind": "bogus"}, "viz": {}},
            },
            session=MagicMock(),
            workspace_id="ws1",
        )


def test_csv_source_missing_url_and_asset_id_raises():
    with pytest.raises(ValueError, match="neither url nor asset_id"):
        chart_data.resolve(
            raw_chapter={
                "type": "chart",
                "chart": {"source": {"kind": "csv"}, "viz": {}},
            },
            session=MagicMock(),
            workspace_id="ws1",
        )
