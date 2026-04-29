"""Story CRUD endpoints."""

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import TypeAdapter
from sqlalchemy import or_

from src.dependencies import get_session
from src.models.story import (
    ChapterPayload,
    StoryCreate,
    StoryResponse,
    StoryRow,
    StoryUpdate,
)
from src.services import story_export
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api")

_chapter_adapter: TypeAdapter[ChapterPayload] = TypeAdapter(ChapterPayload)


def _coerce_chapter(raw: dict) -> ChapterPayload:
    """Parse a chapter dict, backfilling the default type for legacy rows."""
    if "type" not in raw:
        inferred_type = (
            "scrollytelling"
            if raw.get("map_state") or raw.get("layer_config")
            else "prose"
        )
        raw = {**raw, "type": inferred_type}
    return _chapter_adapter.validate_python(raw)


def _row_to_response(row: StoryRow) -> StoryResponse:
    chapters = json.loads(row.chapters_json) if row.chapters_json else []
    chapter_dataset_ids = []
    for ch in chapters:
        lc = ch.get("layer_config") or {}
        ds_id = lc.get("dataset_id")
        if ds_id and ds_id not in chapter_dataset_ids:
            chapter_dataset_ids.append(ds_id)
    dataset_ids = (
        chapter_dataset_ids
        if chapter_dataset_ids
        else ([row.dataset_id] if row.dataset_id else [])
    )
    return StoryResponse(
        id=row.id,
        title=row.title,
        description=row.description,
        dataset_id=row.dataset_id,
        dataset_ids=dataset_ids,
        chapters=[_coerce_chapter(ch) for ch in chapters],
        published=row.published,
        is_example=bool(row.is_example),
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


@router.post("/stories", status_code=201)
async def create_story(body: StoryCreate, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        row = StoryRow(
            id=str(uuid.uuid4()),
            title=body.title,
            description=body.description,
            dataset_id=body.dataset_id,
            chapters_json=json.dumps([ch.model_dump() for ch in body.chapters]),
            published=body.published,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            workspace_id=workspace_id if workspace_id else None,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()


@router.get("/stories")
async def list_stories(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        rows = (
            session.query(StoryRow)
            .filter(
                or_(
                    StoryRow.workspace_id == workspace_id, StoryRow.is_example.is_(True)
                )
            )
            .order_by(StoryRow.created_at.desc())
            .all()
        )
        return [_row_to_response(r) for r in rows]
    finally:
        session.close()


@router.get("/stories/{story_id}")
async def get_story(story_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        # If the requester owns the story, return it regardless of published state.
        # Otherwise, only return published stories.
        if row.workspace_id != workspace_id and not row.published:
            raise HTTPException(status_code=404, detail="Story not found")
        return _row_to_response(row)
    finally:
        session.close()


@router.get("/stories/{story_id}/export/config")
async def export_story_config(story_id: str, request: Request):
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
        return config.model_dump(mode="json")
    finally:
        session.close()


@router.patch("/stories/{story_id}")
async def update_story(story_id: str, body: StoryUpdate, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if row.is_example:
            raise HTTPException(
                status_code=403, detail="Example stories cannot be modified"
            )
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if body.title is not None:
            row.title = body.title
        if body.description is not None:
            row.description = body.description
        if body.chapters is not None:
            row.chapters_json = json.dumps([ch.model_dump() for ch in body.chapters])
        if body.published is not None:
            row.published = body.published
        row.updated_at = datetime.now(UTC)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()


@router.post("/stories/{story_id}/fork")
async def fork_story(story_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        source = session.get(StoryRow, story_id)
        if not source:
            raise HTTPException(status_code=404, detail="Story not found")

        now = datetime.now(UTC)
        forked = StoryRow(
            id=str(uuid.uuid4()),
            title=source.title,
            description=source.description,
            dataset_id=source.dataset_id,
            chapters_json=source.chapters_json,
            published=False,
            created_at=now,
            updated_at=now,
            workspace_id=workspace_id,
            is_example=False,
        )
        session.add(forked)
        session.commit()
        session.refresh(forked)
        return _row_to_response(forked)
    finally:
        session.close()


@router.delete("/stories/{story_id}", status_code=204)
async def delete_story(story_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if row.is_example:
            raise HTTPException(
                status_code=403, detail="Example stories cannot be deleted"
            )
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        session.delete(row)
        session.commit()
    finally:
        session.close()
