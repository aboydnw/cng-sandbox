"""Story asset endpoints: upload, fetch, delete."""

import io
import json
import os
import uuid
from typing import Literal

import obstore
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from src.dependencies import get_session
from src.models.story_asset import StoryAssetRow
from src.services import image_processing
from src.services.storage import StorageService
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api")

MAX_IMAGE_BYTES = 25 * 1024 * 1024
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}


def _put_object(key: str, body: bytes, content_type: str) -> str:
    storage = StorageService()
    obstore.put(storage.store, key, io.BytesIO(body))
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    return f"{base}/{key}"


def _delete_object(key: str) -> None:
    storage = StorageService()
    storage.delete_object(key)


def _public_url(key: str) -> str:
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    return f"{base}/{key}"


@router.post("/story-assets", status_code=201)
async def upload_story_asset(
    request: Request,
    file: UploadFile = File(...),
    kind: Literal["image", "csv"] = Form(...),
    story_id: str | None = Form(default=None),
):
    """Upload a binary asset (image or CSV) to attach to a story."""
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)

    raw = await file.read()
    asset_id = str(uuid.uuid4())

    if kind == "image":
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="image larger than 25MB")
        if file.content_type not in ALLOWED_IMAGE_MIMES:
            raise HTTPException(
                status_code=415,
                detail="image must be jpeg, png, or webp",
            )
        try:
            compressed = image_processing.compress_image(raw)
        except image_processing.InvalidImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        ext = "jpg" if compressed.original_mime == "image/jpeg" else "png"
        ws = workspace_id or "public"
        original_key = f"story-assets/{ws}/{asset_id}/original.{ext}"
        thumbnail_key = f"story-assets/{ws}/{asset_id}/thumbnail.jpg"

        original_url = _put_object(original_key, compressed.original_bytes, compressed.original_mime)
        thumbnail_url = _put_object(thumbnail_key, compressed.thumbnail_bytes, compressed.thumbnail_mime)

        session = get_session(request)
        try:
            row = StoryAssetRow(
                id=asset_id,
                workspace_id=workspace_id if workspace_id else None,
                story_id=story_id,
                kind="image",
                original_key=original_key,
                thumbnail_key=thumbnail_key,
                width=compressed.width,
                height=compressed.height,
                mime=compressed.original_mime,
                size_bytes=len(compressed.original_bytes),
            )
            session.add(row)
            session.commit()
        finally:
            session.close()

        return {
            "asset_id": asset_id,
            "url": original_url,
            "thumbnail_url": thumbnail_url,
            "width": compressed.width,
            "height": compressed.height,
            "mime": compressed.original_mime,
            "size_bytes": len(compressed.original_bytes),
        }

    raise HTTPException(status_code=400, detail=f"kind '{kind}' not yet supported")


@router.get("/story-assets/{asset_id}")
def get_story_asset(asset_id: str, request: Request):
    """Return metadata for a single story asset."""
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        row = session.query(StoryAssetRow).filter_by(id=asset_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="asset not found")
        if row.workspace_id and row.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="asset not found")
        return {
            "asset_id": row.id,
            "kind": row.kind,
            "url": _public_url(row.original_key),
            "thumbnail_url": _public_url(row.thumbnail_key) if row.thumbnail_key else None,
            "width": row.width,
            "height": row.height,
            "mime": row.mime,
            "size_bytes": row.size_bytes,
            "row_count": row.row_count,
            "columns": json.loads(row.columns_json) if row.columns_json else None,
        }
    finally:
        session.close()


@router.delete("/story-assets/{asset_id}", status_code=204)
def delete_story_asset(asset_id: str, request: Request):
    """Delete a story asset and its associated storage objects."""
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.query(StoryAssetRow).filter_by(id=asset_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="asset not found")
        if row.workspace_id and row.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="asset not found")
        _delete_object(row.original_key)
        if row.thumbnail_key:
            _delete_object(row.thumbnail_key)
        session.delete(row)
        session.commit()
    finally:
        session.close()
    return None
