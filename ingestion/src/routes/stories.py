"""Story CRUD endpoints."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from src.models.story import StoryRow, StoryCreate, StoryUpdate, StoryResponse, ChapterPayload

router = APIRouter(prefix="/api")


def _get_session(request: Request) -> Session:
    return request.app.state.db_session_factory()


def _row_to_response(row: StoryRow) -> StoryResponse:
    chapters = json.loads(row.chapters_json) if row.chapters_json else []
    chapter_dataset_ids = []
    for ch in chapters:
        lc = ch.get("layer_config") or {}
        ds_id = lc.get("dataset_id")
        if ds_id and ds_id not in chapter_dataset_ids:
            chapter_dataset_ids.append(ds_id)
    dataset_ids = chapter_dataset_ids if chapter_dataset_ids else [row.dataset_id]
    return StoryResponse(
        id=row.id,
        title=row.title,
        description=row.description,
        dataset_id=row.dataset_id,
        dataset_ids=dataset_ids,
        chapters=[ChapterPayload(**ch) for ch in chapters],
        published=row.published,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


@router.post("/stories", status_code=201)
async def create_story(body: StoryCreate, request: Request):
    session = _get_session(request)
    try:
        row = StoryRow(
            id=str(uuid.uuid4()),
            title=body.title,
            description=body.description,
            dataset_id=body.dataset_id,
            chapters_json=json.dumps([ch.model_dump() for ch in body.chapters]),
            published=body.published,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()


@router.get("/stories")
async def list_stories(request: Request):
    session = _get_session(request)
    try:
        rows = session.query(StoryRow).order_by(StoryRow.created_at.desc()).all()
        return [_row_to_response(r) for r in rows]
    finally:
        session.close()


@router.get("/stories/{story_id}")
async def get_story(story_id: str, request: Request):
    session = _get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        return _row_to_response(row)
    finally:
        session.close()


@router.patch("/stories/{story_id}")
async def update_story(story_id: str, body: StoryUpdate, request: Request):
    session = _get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if body.title is not None:
            row.title = body.title
        if body.description is not None:
            row.description = body.description
        if body.chapters is not None:
            row.chapters_json = json.dumps([ch.model_dump() for ch in body.chapters])
        if body.published is not None:
            row.published = body.published
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()


@router.delete("/stories/{story_id}", status_code=204)
async def delete_story(story_id: str, request: Request):
    session = _get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        session.delete(row)
        session.commit()
    finally:
        session.close()
