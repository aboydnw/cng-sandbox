"""Python port of frontend echarts option builders (frontend/src/lib/story/charts.ts).

Produces structurally identical option JSON so the archive runtime can pass the
serialized result directly into `echarts.init(...).setOption(opt)`.
"""

from __future__ import annotations

from datetime import datetime
from math import isfinite
from typing import Any

_COMMON_TOOLBOX = {
    "feature": {
        "dataZoom": {"yAxisIndex": "none"},
        "restore": {},
        "saveAsImage": {},
        "dataView": {"readOnly": True},
    }
}


def line_option_from_timeseries(
    points: list[dict[str, Any]],
    x_label: str = "",
    y_label: str = "",
    y_scale: str = "linear",
) -> dict[str, Any]:
    return {
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
        "toolbox": _COMMON_TOOLBOX,
        "grid": {"left": 50, "right": 30, "top": 30, "bottom": 60},
        "xAxis": {"type": "time", "name": x_label or ""},
        "yAxis": {
            "type": "log" if y_scale == "log" else "value",
            "name": y_label or "",
        },
        "dataZoom": [
            {"type": "inside"},
            {"type": "slider", "height": 20, "bottom": 10},
        ],
        "series": [
            {
                "type": "line",
                "smooth": True,
                "showSymbol": False,
                "data": [[p["datetime"], p["value"]] for p in points],
            }
        ],
    }


def bar_option_from_histogram(bins: list[dict[str, Any]]) -> dict[str, Any]:
    labels: list[str] = []
    counts: list[int] = []
    for b in bins:
        if "label" in b:
            labels.append(b["label"])
        else:
            labels.append(f"{b['bin_min']}–{b['bin_max']}")
        counts.append(b["count"])
    return {
        "tooltip": {"trigger": "axis"},
        "toolbox": _COMMON_TOOLBOX,
        "grid": {"left": 50, "right": 30, "top": 30, "bottom": 60},
        "xAxis": {"type": "category", "data": labels},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": counts}],
    }


def _infer_x_axis_type(rows: list[dict[str, Any]], x_field: str) -> str:
    values = [r.get(x_field) for r in rows]
    if not values:
        return "category"
    if all(isinstance(v, (int, float)) and isfinite(v) for v in values):
        return "value"
    if all(isinstance(v, str) for v in values):
        try:
            for v in values:
                datetime.fromisoformat(v.replace("Z", "+00:00"))
            return "time"
        except ValueError:
            pass
    return "category"


def option_from_csv_rows(
    rows: list[dict[str, Any]],
    viz: dict[str, Any],
    interactive: bool = True,
) -> dict[str, Any]:
    series_field = viz.get("series_field") or None
    y_fields = viz["y_fields"]
    if not y_fields:
        raise ValueError("chart is missing a Y column")
    y_field = y_fields[0]
    x_field = viz["x_field"]

    if series_field:
        groups: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            key = str(r.get(series_field, ""))
            groups.setdefault(key, []).append(r)
        series = [
            {
                "name": name,
                "type": viz["kind"],
                "smooth": viz["kind"] == "line",
                "showSymbol": False,
                "data": [[r[x_field], r[y_field]] for r in group_rows],
            }
            for name, group_rows in groups.items()
        ]
    else:
        series = [
            {
                "name": f,
                "type": viz["kind"],
                "smooth": viz["kind"] == "line",
                "showSymbol": False,
                "data": [[r[x_field], r[f]] for r in rows],
            }
            for f in y_fields
        ]

    x_axis_type = _infer_x_axis_type(rows, x_field)

    x_axis: dict[str, Any] = {"type": x_axis_type, "name": viz.get("x_label") or ""}
    if x_axis_type in ("value", "time"):
        x_axis["min"] = "dataMin"
        x_axis["max"] = "dataMax"

    show_legend = len(series) > 1
    tooltip: dict[str, Any] = {"trigger": "axis", "axisPointer": {"type": "cross"}}

    data_zoom: list[dict[str, Any]] = [{"type": "inside"}]
    if interactive:
        data_zoom.append({"type": "slider", "height": 20, "bottom": 10})

    return {
        "tooltip": tooltip,
        "toolbox": _COMMON_TOOLBOX,
        "legend": {"top": 0} if show_legend else None,
        "grid": {
            "left": 50,
            "right": 30,
            "top": 50 if show_legend else 30,
            "bottom": 60,
        },
        "xAxis": x_axis,
        "yAxis": {
            "type": "log" if viz.get("y_scale") == "log" else "value",
            "name": viz.get("y_label") or "",
        },
        "dataZoom": data_zoom,
        "series": series,
    }
