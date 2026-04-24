"""Allowlist and Pydantic payload for preferred_colormap validation.

Mirrors the colormap list exposed by the frontend
(frontend/src/lib/maptool/colormaps.ts — `COLORMAPS` keys) so the backend
rejects values the frontend picker can't produce. Update both lists together.
"""

from pydantic import BaseModel, field_validator

ALLOWED_COLORMAPS: frozenset[str] = frozenset(
    (
        "blues",
        "cividis",
        "coolwarm",
        "gray",
        "greens",
        "inferno",
        "magma",
        "plasma",
        "rdbu",
        "rdylgn",
        "reds",
        "terrain",
        "viridis",
        "ylorrd",
    )
)


class ColormapPayload(BaseModel):
    preferred_colormap: str | None
    preferred_colormap_reversed: bool | None

    @field_validator("preferred_colormap")
    @classmethod
    def _check_colormap(cls, v: str | None) -> str | None:
        if v is None:
            return v
        normalized = v.lower()
        if normalized not in ALLOWED_COLORMAPS:
            raise ValueError(
                f"Unknown colormap: {v!r}. Allowed: {sorted(ALLOWED_COLORMAPS)}"
            )
        return normalized
