"""Connection CRUD endpoints."""

import asyncio
import json
import logging
import time
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from src.dependencies import get_session
from src.models.connection import ConnectionRow
from src.rate_limit import limiter
from src.services import geoparquet_to_pmtiles, sharing
from src.services.categorical import detect_categories
from src.services.colormap import ColormapPayload
from src.services.render_mode import RenderModePayload, check_render_mode_allowed
from src.services.url_validation import SSRFError, raise_if_redirect, validate_url_safe
from src.workspace import validate_workspace_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024


def _sanitize_url_for_log(url: str) -> str:
    return url.split("?")[0]


async def _head_content_length(url: str) -> int | None:
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=5) as http:
            r = await http.head(url)
            raise_if_redirect(r)
            cl = r.headers.get("content-length")
            return int(cl) if cl else None
    except SSRFError:
        raise
    except (httpx.HTTPError, ValueError):
        return None


VALID_CONNECTION_TYPES = {"xyz_raster", "xyz_vector", "cog", "pmtiles", "geoparquet"}
VALID_TILE_TYPES = {"raster", "vector", None}


class CategoryUpdate(BaseModel):
    value: int
    label: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class ConnectionCreate(BaseModel):
    name: str
    url: str
    connection_type: str
    bounds: list[float] | None = None
    min_zoom: int | None = None
    max_zoom: int | None = None
    tile_type: str | None = None
    band_count: int | None = None
    rescale: str | None = None
    render_path: str | None = None  # "client" | "server"

    def model_post_init(self, __context):
        if self.bounds is not None and len(self.bounds) != 4:
            raise ValueError(
                "bounds must have exactly 4 elements [west, south, east, north]"
            )


async def _run_conversion_bg(connection_id: str, db_session_factory) -> None:
    """Background wrapper that opens its own session and runs the sync job."""

    def _job() -> None:
        session = db_session_factory()
        try:
            geoparquet_to_pmtiles.run_conversion(connection_id, session)
        finally:
            session.close()

    await asyncio.to_thread(_job)


@router.get("/connections")
async def list_connections(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = get_session(request)
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
@limiter.limit("30/hour")
async def create_connection(
    body: ConnectionCreate,
    request: Request,
    background_tasks: BackgroundTasks,
):
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

    is_categorical = False
    categories_json = None
    file_size = None
    render_path = body.render_path
    if body.connection_type == "geoparquet" and render_path not in (
        "client",
        "server",
        None,
    ):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid render_path: {render_path}. Must be 'client' or 'server'.",
        )

    try:
        validate_url_safe(body.url)

        if body.connection_type == "cog":
            # Pre-flight HEAD to ensure the user-supplied URL doesn't redirect.
            # GDAL /vsicurl/ follows redirects internally with no public knob
            # to disable, so a 302 to a private IP would otherwise bypass the
            # SSRF guard above. This catches the literal-redirector case only;
            # GDAL may still chase redirects fetched mid-stream.
            # Also captures Content-Length to populate file_size, which gates
            # client-side render eligibility.
            try:
                async with httpx.AsyncClient(
                    follow_redirects=False, timeout=10.0
                ) as http:
                    head_resp = await http.head(body.url)
                    raise_if_redirect(head_resp)
                    cl = head_resp.headers.get("content-length")
                    file_size = int(cl) if cl else None
            except httpx.HTTPError:
                pass
            try:
                result = await asyncio.to_thread(
                    detect_categories, f"/vsicurl/{body.url}"
                )
                if result.is_categorical:
                    is_categorical = True
                    categories_json = json.dumps(
                        [
                            {"value": c.value, "color": c.color, "label": c.label}
                            for c in result.categories
                        ]
                    )
            except Exception:
                logger.exception(
                    "Categorical detection failed for %s",
                    _sanitize_url_for_log(body.url),
                )

        if body.connection_type == "geoparquet" and render_path is None:
            inferred_size = await _head_content_length(body.url)
            if inferred_size is None or inferred_size > SIZE_THRESHOLD_BYTES:
                render_path = "server"
            else:
                render_path = "client"
    except SSRFError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    is_server_conversion = (
        body.connection_type == "geoparquet" and render_path == "server"
    )

    session = get_session(request)
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
            band_count=body.band_count,
            rescale=body.rescale,
            workspace_id=workspace_id,
            is_categorical=is_categorical,
            categories_json=categories_json,
            file_size=file_size,
            created_at=datetime.now(UTC),
            render_path=render_path,
            conversion_status="pending" if is_server_conversion else None,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        if is_server_conversion:
            background_tasks.add_task(
                _run_conversion_bg,
                row.id,
                request.app.state.db_session_factory,
            )
        return row.to_dict()
    finally:
        session.close()


@router.get("/connections/{connection_id}/stream")
async def stream_connection_conversion(connection_id: str, request: Request):
    """SSE stream of connection conversion progress.

    Stream access is UUID-gated by design: browser EventSource cannot send
    custom headers, so workspace auth is not enforced here. The endpoint only
    emits conversion status events ({status, tile_url, error, feature_count})
    and returns 404 when the row does not exist. The full connection row is
    still protected by GET /api/connections/{id}.
    """
    # get_session() binds the session to request lifetime (closed before the generator
    # runs); open a short-lived gate session directly to avoid that.
    gate_session = request.app.state.db_session_factory()
    try:
        row = gate_session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
    finally:
        gate_session.close()

    async def event_generator():
        start = time.monotonic()
        last_payload = None
        while time.monotonic() - start < 600:
            if await request.is_disconnected():
                return
            session = get_session(request)
            try:
                row = session.get(ConnectionRow, connection_id)
                if row is None:
                    yield {
                        "event": "status",
                        "data": json.dumps({"status": "not_found"}),
                    }
                    return
                payload = {
                    "status": row.conversion_status or "unknown",
                    "tile_url": row.tile_url,
                    "error": row.conversion_error,
                    "feature_count": row.feature_count,
                }
                if payload != last_payload:
                    last_payload = payload
                    yield {"event": "status", "data": json.dumps(payload)}
                if row.conversion_status in {"ready", "failed"}:
                    return
            finally:
                session.close()
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@router.get("/connections/{connection_id}")
async def get_connection(connection_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if not sharing.can_read_connection(session, row, workspace_id):
            raise HTTPException(status_code=404, detail="Connection not found")
        return row.to_dict()
    finally:
        session.close()


@router.patch("/connections/{connection_id}/categories")
async def update_connection_category_labels(
    connection_id: str,
    updates: list[CategoryUpdate],
    request: Request,
):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if not row.is_categorical:
            raise HTTPException(status_code=400, detail="Connection is not categorical")

        categories = json.loads(row.categories_json) if row.categories_json else []
        existing_values = {c["value"] for c in categories}
        update_map: dict[int, dict] = {}
        for u in updates:
            if u.value not in existing_values:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category value {u.value} not found",
                )
            if u.label is None and u.color is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Update for value {u.value} must include label or color",
                )
            if u.value in update_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate update for category value {u.value}",
                )
            update_map[u.value] = {"label": u.label, "color": u.color}

        for cat in categories:
            patch = update_map.get(cat["value"])
            if not patch:
                continue
            if patch["label"] is not None:
                cat["label"] = patch["label"]
            if patch["color"] is not None:
                cat.setdefault("defaultColor", cat.get("color", patch["color"]))
                cat["color"] = patch["color"]

        row.categories_json = json.dumps(categories)
        session.commit()
        return categories
    finally:
        session.close()


class SharePayload(BaseModel):
    is_shared: bool


@router.patch("/connections/{connection_id}/share")
async def share_connection(
    connection_id: str,
    body: SharePayload,
    request: Request,
):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        row.is_shared = body.is_shared
        session.commit()
        session.refresh(row)
        return row.to_dict()
    finally:
        session.close()


@router.patch("/connections/{connection_id}/render-mode")
async def set_connection_render_mode(
    connection_id: str, body: RenderModePayload, request: Request
):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        reason = check_render_mode_allowed(row, body.render_mode)
        if reason is not None:
            raise HTTPException(status_code=400, detail=reason)
        row.render_mode = body.render_mode
        session.commit()
        session.refresh(row)
        return row.to_dict()
    finally:
        session.close()


def _connection_is_raster(row: ConnectionRow) -> bool:
    if row.connection_type in ("cog", "xyz_raster"):
        return True
    return row.connection_type == "pmtiles" and row.tile_type == "raster"


@router.patch("/connections/{connection_id}/colormap")
async def set_connection_colormap(
    connection_id: str, body: ColormapPayload, request: Request
):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        row = session.get(ConnectionRow, connection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Connection not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if not _connection_is_raster(row):
            raise HTTPException(
                status_code=400,
                detail="preferred_colormap only applies to raster connections",
            )
        row.preferred_colormap = body.preferred_colormap
        if body.preferred_colormap is None:
            row.preferred_colormap_reversed = None
        else:
            row.preferred_colormap_reversed = body.preferred_colormap_reversed
        session.commit()
        session.refresh(row)
        return row.to_dict()
    finally:
        session.close()


@router.delete("/connections/{connection_id}", status_code=204)
async def delete_connection(connection_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = get_session(request)
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
