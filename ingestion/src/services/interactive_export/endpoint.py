"""POST /api/stories/{story_id}/export/interactive route handler."""

from __future__ import annotations

import asyncio
import json
import re
import unicodedata
from typing import Any

from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import Response

from src.dependencies import get_session
from src.models.story import StoryRow
from src.services import story_export
from src.services.interactive_export import builder
from src.services.interactive_export import chart_data as chart_data_resolver

_SLUG_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")
_SLUG_COLLAPSE_DASH = re.compile(r"-{2,}")


def _safe_filename_slug(title: str | None) -> str:
    """Produce an attachment filename slug safe for Content-Disposition.

    Normalizes Unicode to ASCII, replaces any character outside
    `[A-Za-z0-9._-]` with `-`, collapses consecutive dashes, trims to 60
    chars, strips leading dots/dashes, and falls back to "story" if empty.
    """
    raw = (title or "").strip()
    ascii_form = (
        unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    )
    slug = _SLUG_UNSAFE.sub("-", ascii_form)
    slug = _SLUG_COLLAPSE_DASH.sub("-", slug)
    slug = slug.strip("-.")[:60]
    return slug or "story"


async def handle_interactive_export(
    story_id: str,
    request: Request,
    scrolly_pngs: list[UploadFile],
) -> Response:
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if (
            row.workspace_id != workspace_id
            and not row.published
            and not row.is_example
        ):
            raise HTTPException(status_code=404, detail="Story not found")

        config = story_export.build_config(row, session)
        try:
            chapters_raw = json.loads(row.chapters_json) if row.chapters_json else []
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail="Invalid chapters_json"
            ) from exc
        if not isinstance(chapters_raw, list):
            raise HTTPException(status_code=400, detail="chapters_json must be a list")

        chart_data_by_chapter: dict[str, dict[str, Any]] = {}
        for idx, raw in enumerate(chapters_raw):
            if not isinstance(raw, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"chapter at index {idx} must be an object",
                )
            if raw.get("type") != "chart":
                continue
            chapter_id = raw.get("id")
            if not isinstance(chapter_id, str) or not chapter_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"chart chapter at index {idx} missing id",
                )
            try:
                chart_data_by_chapter[chapter_id] = chart_data_resolver.resolve(
                    raw, session, row.workspace_id
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"chart chapter {chapter_id}: {exc}",
                ) from exc

        png_bytes: dict[str, bytes] = {}
        for upload in scrolly_pngs:
            if upload.filename:
                key = upload.filename.rsplit(".", 1)[0]
                png_bytes[key] = await upload.read()

        try:
            zip_bytes = await asyncio.to_thread(
                builder.build_interactive_export,
                config=config,
                chapters_raw=chapters_raw,
                chart_data_by_chapter=chart_data_by_chapter,
                scrolly_pngs=png_bytes,
            )
        except ValueError as exc:
            msg = str(exc)
            status = (
                400
                if "zarr" in msg
                or "snapshot" in msg
                or "too large" in msg
                or "not yet supported" in msg
                or "source unavailable" in msg
                else 500
            )
            raise HTTPException(status_code=status, detail=msg) from exc

        slug = _safe_filename_slug(row.title)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{slug}.zip"',
            },
        )
    finally:
        session.close()
