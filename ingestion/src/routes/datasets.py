"""Dataset metadata routes."""

import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService

router = APIRouter(prefix="/api")


def _get_session(request: Request) -> Session:
    return request.app.state.db_session_factory()


def _story_count_for_dataset(session: Session, dataset_id: str) -> int:
    """Count stories that reference a dataset (in dataset_id or chapters_json)."""
    count = 0
    rows = session.query(StoryRow).all()
    for row in rows:
        if row.dataset_id == dataset_id:
            count += 1
            continue
        chapters = json.loads(row.chapters_json) if row.chapters_json else []
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            if lc.get("dataset_id") == dataset_id:
                count += 1
                break
    return count


@router.get("/datasets")
async def list_datasets(request: Request):
    session = _get_session(request)
    try:
        rows = session.query(DatasetRow).order_by(DatasetRow.created_at.desc()).all()
        result = []
        for row in rows:
            d = row.to_dict()
            d["story_count"] = _story_count_for_dataset(session, row.id)
            result.append(d)
        return result
    finally:
        session.close()


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, request: Request):
    session = _get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        d = row.to_dict()
        d["story_count"] = _story_count_for_dataset(session, row.id)
        return d
    finally:
        session.close()


@router.delete("/datasets/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: str, request: Request):
    session = _get_session(request)
    try:
        s3 = getattr(request.app.state, "s3", None)
        storage = StorageService(s3_client=s3) if s3 else None
        result = await delete_dataset(session, dataset_id, storage=storage)
        if result is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return result
    finally:
        session.close()
