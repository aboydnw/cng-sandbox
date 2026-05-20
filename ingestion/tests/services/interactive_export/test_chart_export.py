import json
from pathlib import Path

from src.services.interactive_export import chart_export

CSV_FIXTURE = Path(__file__).parent / "fixtures" / "csv_chart_rows.json"


def test_line_option_from_timeseries():
    points = [
        {"datetime": "2020-01-01", "value": 1.0},
        {"datetime": "2020-02-01", "value": 2.0},
    ]
    opt = chart_export.line_option_from_timeseries(
        points, x_label="Time", y_label="Val", y_scale="linear"
    )
    assert opt["xAxis"]["type"] == "time"
    assert opt["yAxis"]["type"] == "value"
    assert opt["series"][0]["type"] == "line"
    assert opt["series"][0]["data"] == [
        ["2020-01-01", 1.0],
        ["2020-02-01", 2.0],
    ]


def test_bar_option_from_histogram_labelled_bins():
    bins = [
        {"class": 1, "label": "low", "count": 10},
        {"class": 2, "label": "high", "count": 5},
    ]
    opt = chart_export.bar_option_from_histogram(bins)
    assert opt["xAxis"]["type"] == "category"
    assert opt["xAxis"]["data"] == ["low", "high"]
    assert opt["series"][0]["data"] == [10, 5]


def test_bar_option_from_histogram_range_bins():
    bins = [
        {"bin_min": 0.0, "bin_max": 1.0, "count": 3},
        {"bin_min": 1.0, "bin_max": 2.0, "count": 7},
    ]
    opt = chart_export.bar_option_from_histogram(bins)
    assert opt["xAxis"]["data"] == ["0.0–1.0", "1.0–2.0"]  # noqa: RUF001
    assert opt["series"][0]["data"] == [3, 7]


def test_csv_option_grouped_by_series_field():
    fixture = json.loads(CSV_FIXTURE.read_text())
    opt = chart_export.option_from_csv_rows(fixture["rows"], fixture["viz"])
    assert len(opt["series"]) == 2
    series_names = {s["name"] for s in opt["series"]}
    assert series_names == {"north", "south"}
    assert opt["legend"] == {"top": 0}
    assert opt["xAxis"]["type"] == "value"


def test_csv_option_no_series_field_uses_y_fields():
    rows = [{"year": 2020, "yield": 10.0}, {"year": 2021, "yield": 12.0}]
    viz = {
        "kind": "bar",
        "x_field": "year",
        "y_fields": ["yield"],
        "series_field": None,
        "x_label": "Year",
        "y_label": "Yield",
        "y_scale": "linear",
    }
    opt = chart_export.option_from_csv_rows(rows, viz)
    assert len(opt["series"]) == 1
    assert opt["series"][0]["name"] == "yield"
    assert opt.get("legend") is None
