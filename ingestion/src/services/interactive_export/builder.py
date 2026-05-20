"""Orchestrates per-chapter export and assembles the final zip.

Task 1 ships the orchestrator with all chapter types treated as a no-op except
for manifest entries. Later tasks fill in raster, vector, and chart builders.
"""

from __future__ import annotations

import io
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.services.interactive_export import html_shell


def build_chapter_manifest_entry(chapter: dict[str, Any]) -> dict[str, Any]:
    """Return the minimal manifest entry for any chapter type."""
    return {
        "id": chapter["id"],
        "type": chapter["type"],
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
    }


def build_interactive_export(
    story: dict[str, Any],
    chapters: list[dict[str, Any]],
    datasets: dict[str, dict[str, Any]],
    connections: dict[str, dict[str, Any]],
    scrolly_pngs: dict[str, bytes],
) -> bytes:
    """Build the interactive export zip and return its bytes.

    Args:
        story: Story metadata.
        chapters: Ordered list of chapter dicts (already enriched by the endpoint).
        datasets: Map of dataset id -> dataset row.
        connections: Map of connection id -> connection row.
        scrolly_pngs: Map of chapter id -> PNG bytes for scrollytelling snapshots.
    """
    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp)
        (staging / "chapters").mkdir()
        (staging / "assets").mkdir()
        (staging / "runtime").mkdir()

        manifest_chapters: list[dict[str, Any]] = [
            build_chapter_manifest_entry(ch) for ch in chapters
        ]

        manifest = {
            "story": {
                "id": story["id"],
                "title": story.get("title", ""),
                "description": story.get("description", ""),
            },
            "exported_at": datetime.now(UTC).isoformat(),
            "runtime_version": "0.1.0-plan1",
            "chapters": manifest_chapters,
        }

        html_shell.write_shell(staging, manifest)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(staging))
        return buf.getvalue()
