"""Tools for story operations."""

from typing import Any
from mcp.types import TextContent
from cng_mcp.client.sandbox_api import SandboxAPIClient


async def read_story_tool(client: SandboxAPIClient, story_id: str) -> TextContent:
    """Get a story by ID."""
    story = await client.get_story(story_id)
    lines = [f"# {story.get('title', 'Untitled Story')}\n",
             f"**Description**: {story.get('description', 'No description')}\n"]

    chapters = story.get("chapters", [])
    if chapters:
        lines.append("## Chapters\n")
        for i, ch in enumerate(chapters, 1):
            lines.append(f"### {i}. {ch.get('title', 'Untitled Chapter')}")
            lines.append(f"- **Dataset**: {ch.get('dataset_id', 'unknown')}")
            lines.append(f"- **Text**: {ch.get('text', '')}\n")
    return TextContent(type="text", text="\n".join(lines))


async def create_story_tool(
    client: SandboxAPIClient,
    title: str,
    description: str,
    chapters: list[dict[str, Any]],
) -> TextContent:
    """Create a new story."""
    if not title:
        return TextContent(type="text", text="Error: title is required")

    story = await client.create_story(title=title, description=description, chapters=chapters)
    story_id = story.get("id", "unknown")
    lines = [
        f"# Story Created Successfully\n",
        f"**Story ID**: `{story_id}`",
        f"**Title**: {title}",
        f"**Description**: {description}",
        f"**Chapters**: {len(chapters)}",
        f"\nShare with others using story ID: `{story_id}`",
    ]
    return TextContent(type="text", text="\n".join(lines))


async def update_story_tool(
    client: SandboxAPIClient,
    story_id: str,
    updates: dict[str, Any],
) -> TextContent:
    """Update an existing story."""
    if not story_id:
        return TextContent(type="text", text="Error: story_id is required")

    await client.update_story(story_id=story_id, updates=updates)
    lines = [
        f"# Story Updated\n",
        f"**Story ID**: `{story_id}`",
        f"**Updated Fields**: {', '.join(updates.keys())}",
    ]
    return TextContent(type="text", text="\n".join(lines))
