"""Tests for colormaps resource."""

import pytest
from cng_mcp.resources.colormaps import list_colormaps_resource


@pytest.mark.asyncio
async def test_list_colormaps():
    content = await list_colormaps_resource()
    assert "Available Colormaps" in content
    assert "viridis" in content
    assert "Sequential" in content
    assert "Diverging" in content
