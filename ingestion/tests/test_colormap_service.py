import pytest
from pydantic import ValidationError

from src.services.colormap import ALLOWED_COLORMAPS, ColormapPayload


def test_allowlist_contains_known_colormaps():
    assert "viridis" in ALLOWED_COLORMAPS
    assert "terrain" in ALLOWED_COLORMAPS
    assert "plasma" in ALLOWED_COLORMAPS


def test_payload_accepts_valid_colormap_and_reversed():
    payload = ColormapPayload(
        preferred_colormap="terrain", preferred_colormap_reversed=False
    )
    assert payload.preferred_colormap == "terrain"
    assert payload.preferred_colormap_reversed is False


def test_payload_accepts_null_colormap_and_null_reversed():
    payload = ColormapPayload(
        preferred_colormap=None, preferred_colormap_reversed=None
    )
    assert payload.preferred_colormap is None
    assert payload.preferred_colormap_reversed is None


def test_payload_rejects_unknown_colormap():
    with pytest.raises(ValidationError):
        ColormapPayload(
            preferred_colormap="not-a-real-colormap",
            preferred_colormap_reversed=False,
        )


def test_payload_is_case_insensitive_and_normalizes_to_lowercase():
    payload = ColormapPayload(
        preferred_colormap="Terrain", preferred_colormap_reversed=False
    )
    assert payload.preferred_colormap == "terrain"
