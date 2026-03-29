"""Dataset metadata routes."""

from fastapi import APIRouter, HTTPException, Request

from src.dependencies import get_session
from src.models.dataset import DatasetRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService
from src.services.story_utils import build_story_count_map, find_stories_referencing_dataset
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api")


@router.get("/datasets")
async def list_datasets(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        rows = (
            session.query(DatasetRow)
            .filter(DatasetRow.workspace_id == workspace_id)
            .order_by(DatasetRow.created_at.desc())
            .all()
        )
        story_counts = build_story_count_map(session)
        result = []
        for row in rows:
            d = row.to_dict()
            d["story_count"] = story_counts.get(row.id, 0)
            result.append(d)
        return result
    finally:
        session.close()


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, request: Request):
    session = get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        d = row.to_dict()
        d["story_count"] = len(find_stories_referencing_dataset(session, row.id))
        return d
    finally:
        session.close()


@router.delete("/datasets/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        storage = StorageService()
        result = await delete_dataset(session, dataset_id, storage=storage)
        return result
    finally:
        session.close()
