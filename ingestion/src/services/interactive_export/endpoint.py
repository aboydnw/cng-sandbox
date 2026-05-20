"""POST /api/stories/{story_id}/export/interactive route handler."""

from __future__ import annotations

import json

from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import Response

from src.dependencies import get_session
from src.models.story import StoryRow
from src.services.interactive_export import builder


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

        story = {
            "id": row.id,
            "title": row.title or "",
            "description": row.description or "",
        }
        chapters = json.loads(row.chapters_json) if row.chapters_json else []

        png_bytes: dict[str, bytes] = {}
        for upload in scrolly_pngs:
            if upload.filename:
                key = upload.filename.rsplit(".", 1)[0]
                png_bytes[key] = await upload.read()

        try:
            zip_bytes = builder.build_interactive_export(
                story=story,
                chapters=chapters,
                datasets={},
                connections={},
                scrolly_pngs=png_bytes,
            )
        except ValueError as exc:
            msg = str(exc)
            status = (
                400
                if "zarr" in msg or "snapshot" in msg or "too large" in msg
                else 500
            )
            raise HTTPException(status_code=status, detail=msg) from exc

        slug = (row.title or "story").lower().replace(" ", "-")[:60] or "story"
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{slug}.zip"',
            },
        )
    finally:
        session.close()
