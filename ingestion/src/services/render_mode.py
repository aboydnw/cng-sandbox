"""Server-side render-mode eligibility checks.

Mirrors the frontend's `evaluateClientRenderEligibility` so the stored
`render_mode` value cannot disagree with what the classifier says is possible.
"""

import json

from pydantic import BaseModel, field_validator

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow


class RenderModePayload(BaseModel):
    render_mode: str | None

    @field_validator("render_mode")
    @classmethod
    def _check_value(cls, v):
        if v is None:
            return v
        if v not in ("client", "server"):
            raise ValueError("render_mode must be 'client', 'server', or null")
        return v

CLIENT_RENDER_CAP_PALETTED = 2 * 1024 * 1024 * 1024  # 2 GB
CLIENT_RENDER_CAP_CONTINUOUS = 500 * 1024 * 1024  # 500 MB

_INTEGER_DTYPES = frozenset(
    ("int8", "uint8", "int16", "uint16", "int32", "uint32")
)


def _is_paletted(dtype: str | None, is_categorical: bool) -> bool:
    if dtype in ("uint8", "int8"):
        return True
    return bool(is_categorical and dtype in _INTEGER_DTYPES)


def _dataset_inputs(row: DatasetRow) -> dict:
    meta = json.loads(row.metadata_json) if row.metadata_json else {}
    bounds = json.loads(row.bounds_json) if row.bounds_json else None
    return {
        "cog_url": meta.get("cog_url"),
        "bounds": bounds,
        "is_temporal": bool(meta.get("is_temporal")),
        "size_bytes": meta.get("converted_file_size"),
        "dtype": meta.get("dtype"),
        "is_categorical": bool(meta.get("is_categorical")),
        "kind": "dataset",
    }


def _connection_inputs(row: ConnectionRow) -> dict:
    bounds = json.loads(row.bounds_json) if row.bounds_json else None
    return {
        "cog_url": row.url if row.connection_type == "cog" else None,
        "bounds": bounds,
        "is_temporal": False,
        "size_bytes": row.file_size,
        "dtype": None,
        "is_categorical": bool(row.is_categorical),
        "kind": "connection",
    }


def check_render_mode_allowed(
    row: DatasetRow | ConnectionRow, desired_mode: str | None
) -> str | None:
    """Return None if the mode is allowed, else a short reason string."""
    if desired_mode is None or desired_mode == "server":
        return None
    if desired_mode != "client":
        return "Invalid render_mode"

    inputs = (
        _dataset_inputs(row)
        if isinstance(row, DatasetRow)
        else _connection_inputs(row)
    )

    if inputs["is_temporal"]:
        return "Temporal dataset"
    if not inputs["cog_url"]:
        return "No COG URL"
    bounds = inputs["bounds"]
    if not isinstance(bounds, (list, tuple)) or len(bounds) != 4:
        return "Bounds unavailable"
    try:
        south, north = float(bounds[1]), float(bounds[3])
    except (TypeError, ValueError):
        return "Bounds unavailable"
    if abs(south) >= 85.05 or abs(north) >= 85.05:
        return "Bounds exceed supported latitude range"

    size_bytes = inputs["size_bytes"]
    if inputs["kind"] == "connection" and size_bytes is None:
        return "File size unknown"

    paletted = _is_paletted(inputs["dtype"], inputs["is_categorical"])
    cap = CLIENT_RENDER_CAP_PALETTED if paletted else CLIENT_RENDER_CAP_CONTINUOUS
    if size_bytes is not None and size_bytes > cap:
        return "File exceeds client-render cap"

    return None
