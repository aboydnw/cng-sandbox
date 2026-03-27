"""Connection CRUD endpoints."""

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.models.connection import ConnectionRow
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api")

VALID_CONNECTION_TYPES = {"xyz_raster", "xyz_vector", "cog", "pmtiles"}
VALID_TILE_TYPES = {"raster", "vector", None}


class ConnectionCreate(BaseModel):
    name: str
    url: str
    connection_type: str
    bounds: list[float] | None = None
    min_zoom: int | None = None
    max_zoom: int | None = None
    tile_type: str | None = None


def _get_session(request: Request) -> Session:
    return request.app.state.db_session_factory()


@router.get("/connections")
async def list_connections(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        rows = (
            session.query(ConnectionRow)
            .filter(ConnectionRow.workspace_id == workspace_id)
            .order_by(ConnectionRow.created_at.desc())
            .all()
        )
        return [row.to_dict() for row in rows]
    finally:
        session.close()


@router.post("/connections", status_code=201)
async def create_connection(body: ConnectionCreate, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    if body.connection_type not in VALID_CONNECTION_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid connection_type: {body.connection_type}",
        )
    if body.tile_type not in VALID_TILE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tile_type: {body.tile_type}",
        )
    session = _get_session(request)
    try:
        row = ConnectionRow(
            id=str(uuid.uuid4()),
            name=body.name,
            url=body.url,
            connection_type=body.connection_type,
            bounds_json=json.dumps(body.bounds) if body.bounds else None,
            min_zoom=body.min_zoom,
            max_zoom=body.max_zoom,
            tile_type=body.tile_type,
            workspace_id=workspace_id,
            created_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.to_dict()
    finally:
        session.close()


@router.get("/connections/{connection_id}")
async def get_connection(connection_id: str, request: Request):
    session = _get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        return row.to_dict()
    finally:
        session.close()


@router.delete("/connections/{connection_id}", status_code=204)
async def delete_connection(connection_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        session.delete(row)
        session.commit()
    finally:
        session.close()
