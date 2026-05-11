"""Layer config validation route."""

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import or_

from src.dependencies import get_session
from src.models.dataset import DatasetRow

router = APIRouter(prefix="/api")


class ValidateLayerConfigBody(BaseModel):
    dataset_id: str
    colormap: str
    rescale_min: float | None = None
    rescale_max: float | None = None


@router.post("/validate-layer-config")
def validate_layer_config(body: ValidateLayerConfigBody, request: Request):
    """Check that a dataset exists and colormap is non-empty before creating a story chapter."""
    if not body.colormap or not body.colormap.strip():
        return {"valid": False, "error": "colormap is required"}
    workspace_id = request.headers.get("x-workspace-id", "")
    session = get_session(request)
    try:
        ds = (
            session.query(DatasetRow)
            .filter(
                DatasetRow.id == body.dataset_id,
                or_(
                    DatasetRow.workspace_id == workspace_id,
                    DatasetRow.is_example.is_(True),
                ),
            )
            .first()
        )
        if ds is None:
            return {"valid": False, "error": f"Dataset '{body.dataset_id}' not found"}
        return {"valid": True}
    finally:
        session.close()
