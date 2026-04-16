"""Dataset metadata routes."""

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.dependencies import get_session
from src.models.dataset import DatasetRow
from src.services.categorical import QUALITATIVE_PALETTE
from src.services.categorical_extract import (
    TooManyValues,
    UnsupportedDtype,
    extract_unique_values,
)
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService
from src.services.story_utils import (
    build_story_count_map,
    find_stories_referencing_dataset,
)
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api")


class CategoryLabelUpdate(BaseModel):
    value: int
    label: str


@router.get("/datasets")
async def list_datasets(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        from sqlalchemy import or_

        rows = (
            session.query(DatasetRow)
            .filter(
                or_(
                    DatasetRow.workspace_id == workspace_id,
                    DatasetRow.is_example.is_(True),
                )
            )
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
        if row.is_example:
            raise HTTPException(
                status_code=403, detail="Example datasets cannot be deleted"
            )
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        storage = StorageService()
        result = await delete_dataset(session, dataset_id, storage=storage)
        return result
    finally:
        session.close()


@router.patch("/datasets/{dataset_id}/categories")
async def update_category_labels(
    dataset_id: str,
    updates: list[CategoryLabelUpdate],
    request: Request,
):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if row.is_example:
            raise HTTPException(
                status_code=403, detail="Example datasets cannot be modified"
            )
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        meta = json.loads(row.metadata_json) if row.metadata_json else {}
        if not meta.get("is_categorical"):
            raise HTTPException(status_code=400, detail="Dataset is not categorical")

        categories = meta.get("categories", [])
        existing_values = {c["value"] for c in categories}
        update_map = {}
        for u in updates:
            if u.value not in existing_values:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category value {u.value} not found",
                )
            update_map[u.value] = u.label

        for cat in categories:
            if cat["value"] in update_map:
                cat["label"] = update_map[cat["value"]]

        meta["categories"] = categories
        row.metadata_json = json.dumps(meta, default=str)
        session.commit()
        return categories
    finally:
        session.close()


def extract_unique_values_from_dataset(row: DatasetRow) -> list[int]:
    """Read unique integer values from the dataset's stored raster.

    Exposed as a module-level function so tests can monkeypatch the I/O without
    needing a real R2 fixture.
    """
    meta = json.loads(row.metadata_json) if row.metadata_json else {}
    raster_path = meta.get("cog_path") or meta.get("source_path") or row.tile_url
    return extract_unique_values(raster_path)


@router.post("/datasets/{dataset_id}/mark-categorical")
async def mark_categorical(dataset_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if row.is_example:
            raise HTTPException(
                status_code=403, detail="Example datasets cannot be modified"
            )
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        meta = json.loads(row.metadata_json) if row.metadata_json else {}
        if meta.get("is_categorical"):
            raise HTTPException(status_code=409, detail="Dataset is already categorical")

        try:
            values = extract_unique_values_from_dataset(row)
        except UnsupportedDtype as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": "unsupported_dtype", "dtype": exc.dtype},
            )
        except TooManyValues as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": "too_many_values", "count": exc.count},
            )

        categories = []
        for i, value in enumerate(values):
            color = QUALITATIVE_PALETTE[i % len(QUALITATIVE_PALETTE)]
            categories.append(
                {
                    "value": value,
                    "label": f"Class {value}",
                    "color": color,
                    "defaultColor": color,
                }
            )

        meta["is_categorical"] = True
        meta["categories"] = categories
        row.metadata_json = json.dumps(meta, default=str)
        session.commit()
        return row.to_dict()
    finally:
        session.close()
