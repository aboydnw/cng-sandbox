"""Endpoints for seeding/removing per-workspace example copies."""

from fastapi import APIRouter, Request

from src.dependencies import get_session
from src.models import workspace_example_state as wes
from src.services import example_workspace
from src.workspace import validate_workspace_id

router = APIRouter(prefix="/api/workspaces", tags=["workspace-examples"])


@router.get("/{workspace_id}/examples")
async def get_examples_state(workspace_id: str, request: Request):
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        return {"state": wes.get_state(session, workspace_id)}
    finally:
        session.close()


@router.post("/{workspace_id}/examples")
async def seed_examples(workspace_id: str, request: Request):
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        result = example_workspace.seed_workspace_examples(session, workspace_id)
        return {"state": "seeded", "story_id_map": result["story_id_map"]}
    finally:
        session.close()


@router.delete("/{workspace_id}/examples")
async def remove_examples(workspace_id: str, request: Request):
    validate_workspace_id(workspace_id)
    session = get_session(request)
    try:
        deleted = example_workspace.remove_workspace_examples(session, workspace_id)
        return {"state": "removed", "deleted": deleted}
    finally:
        session.close()
