"""Tests for story templates resource."""

import pytest
from cng_mcp.resources.stories import list_story_templates_resource


@pytest.mark.asyncio
async def test_list_story_templates():
    content = await list_story_templates_resource()
    assert "Story Templates" in content
    assert "Regional Comparison" in content
    assert "Time Series Analysis" in content
    assert "Data Exploration" in content
