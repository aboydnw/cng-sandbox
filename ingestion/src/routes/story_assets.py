"""Story asset endpoints: upload, fetch, delete."""

import io
import json
import logging
import os
import uuid
from typing import Annotated, Literal

import obstore
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from src.dependencies import get_session
from src.models.story_asset import StoryAssetRow
from src.services import image_processing
from src.services.storage import StorageService
from src.workspace import validate_workspace_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

MAX_IMAGE_BYTES = 25 * 1024 * 1024
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}

MAX_CSV_BYTES = 5 * 1024 * 1024
ALLOWED_CSV_MIMES = {"text/csv", "application/vnd.ms-excel", "application/csv"}


def _public_url(key: str) -> str:
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if not base:
        raise RuntimeError("R2_PUBLIC_URL is not configured")
    return f"{base}/{key}"


def _put_object(key: str, body: bytes, content_type: str) -> str:
    url = _public_url(key)
    storage = StorageService()
    obstore.put(
        storage.store,
        key,
        io.BytesIO(body),
        attributes={"Content-Type": content_type},
    )
    return url


def _delete_object(key: str) -> None:
    storage = StorageService()
    storage.delete_object(key)


@router.post("/story-assets", status_code=201)
async def upload_story_asset(
    request: Request,
    file: Annotated[UploadFile, File()],
    kind: Annotated[Literal["image", "csv"], Form()],
    story_id: Annotated[str | None, Form()] = None,
):
    """Upload a binary asset (currently image only) to attach to a story."""
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)

    raw = await file.read()
    asset_id = str(uuid.uuid4())

    if kind == "csv":
        if len(raw) > MAX_CSV_BYTES:
            raise HTTPException(status_code=413, detail="csv larger than 5MB")
        if file.content_type not in ALLOWED_CSV_MIMES:
            raise HTTPException(status_code=415, detail="not a csv")
        try:
            df = pd.read_csv(io.BytesIO(raw))
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"could not parse csv: {exc}"
            ) from exc
        if df.shape[1] == 0:
            raise HTTPException(status_code=400, detail="csv has no columns")

        ws = workspace_id or "public"
        original_key = f"story-assets/{ws}/{asset_id}/data.csv"
        columns = [str(c) for c in df.columns]

        uploaded_keys: list[str] = []
        try:
            _put_object(original_key, raw, "text/csv")
            uploaded_keys.append(original_key)

            session = get_session(request)
            try:
                row = StoryAssetRow(
                    id=asset_id,
                    workspace_id=workspace_id if workspace_id else None,
                    story_id=story_id,
                    kind="csv",
                    original_key=original_key,
                    thumbnail_key=None,
                    width=None,
                    height=None,
                    mime="text/csv",
                    size_bytes=len(raw),
                    row_count=int(df.shape[0]),
                    columns_json=json.dumps(columns),
                )
                session.add(row)
                session.commit()
            finally:
                session.close()
        except Exception:
            for key in uploaded_keys:
                try:
                    _delete_object(key)
                except Exception:
                    logger.exception("failed to clean up orphaned object %s", key)
            raise

        return {
            "asset_id": asset_id,
            "url": _public_url(original_key),
            "thumbnail_url": None,
            "mime": "text/csv",
            "size_bytes": len(raw),
            "columns": columns,
            "row_count": int(df.shape[0]),
        }

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

        uploaded_keys: list[str] = []
        try:
            original_url = _put_object(
                original_key, compressed.original_bytes, compressed.original_mime
            )
            uploaded_keys.append(original_key)
            thumbnail_url = _put_object(
                thumbnail_key, compressed.thumbnail_bytes, compressed.thumbnail_mime
            )
            uploaded_keys.append(thumbnail_key)

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
        except Exception:
            for key in uploaded_keys:
                try:
                    _delete_object(key)
                except Exception:
                    logger.exception("failed to clean up orphaned object %s", key)
            raise

        return {
            "asset_id": asset_id,
            "url": original_url,
            "thumbnail_url": thumbnail_url,
            "width": compressed.width,
            "height": compressed.height,
            "mime": compressed.original_mime,
            "size_bytes": len(compressed.original_bytes),
        }

    raise HTTPException(status_code=400, detail=f"kind '{kind}' not supported")


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
            "thumbnail_url": _public_url(row.thumbnail_key)
            if row.thumbnail_key
            else None,
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
        original_key = row.original_key
        thumbnail_key = row.thumbnail_key
        session.delete(row)
        session.commit()
    finally:
        session.close()
    for key in (original_key, thumbnail_key):
        if not key:
            continue
        try:
            _delete_object(key)
        except Exception:
            logger.exception("failed to delete storage object %s", key)
    return None
