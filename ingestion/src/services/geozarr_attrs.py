"""Validate user-supplied GeoZarr metadata overrides for zarr connections.

These attrs are passed verbatim to the deck.gl-zarr `ZarrLayer.metadata` prop,
which feeds `@developmentseed/geozarr.parseGeoZarrMetadata`. We pre-validate
the four single-resolution required keys here so the frontend gets a 422 early
instead of a runtime parse error.
"""

import re
from typing import Any

_EPSG_RE = re.compile(r"^EPSG:\d+$")
_REQUIRED = ("spatial:dimensions", "spatial:transform", "spatial:shape", "proj:code")


def validate_geozarr_attrs(value: Any) -> None:
    """Raise ValueError if `value` is not a valid GeoZarr override dict."""
    if not isinstance(value, dict):
        raise ValueError("geozarr_attrs must be an object")
    for key in _REQUIRED:
        if key not in value:
            raise ValueError(f"geozarr_attrs missing required key: {key}")

    dims = value["spatial:dimensions"]
    if (
        not isinstance(dims, list)
        or len(dims) != 2
        or not all(isinstance(d, str) and d for d in dims)
    ):
        raise ValueError(
            "spatial:dimensions must be a list of two non-empty strings"
        )

    transform = value["spatial:transform"]
    if (
        not isinstance(transform, list)
        or len(transform) != 6
        or not all(
            isinstance(n, (int, float)) and not isinstance(n, bool) for n in transform
        )
    ):
        raise ValueError("spatial:transform must be a list of six numbers")

    shape = value["spatial:shape"]
    if (
        not isinstance(shape, list)
        or len(shape) != 2
        or not all(
            isinstance(n, int) and not isinstance(n, bool) and n > 0 for n in shape
        )
    ):
        raise ValueError("spatial:shape must be a list of two positive integers")

    code = value["proj:code"]
    if not isinstance(code, str) or not _EPSG_RE.match(code):
        raise ValueError('proj:code must be a string matching "EPSG:<digits>"')
