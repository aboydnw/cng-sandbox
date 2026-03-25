"""Dataset persistence model."""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text

from src.models.base import Base


class DatasetRow(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    dataset_type = Column(String, nullable=False)
    format_pair = Column(String, nullable=False)
    tile_url = Column(String, nullable=False)
    bounds_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    workspace_id = Column(String, nullable=True)

    def to_dict(self) -> dict:
        """Convert to the Dataset API response format."""
        meta = json.loads(self.metadata_json) if self.metadata_json else {}
        bounds = json.loads(self.bounds_json) if self.bounds_json else None
        return {
            **meta,
            "id": self.id,
            "filename": self.filename,
            "dataset_type": self.dataset_type,
            "format_pair": self.format_pair,
            "tile_url": self.tile_url,
            "bounds": bounds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "workspace_id": self.workspace_id,
        }


_TOP_LEVEL_COLUMNS = frozenset(
    ("id", "filename", "dataset_type", "format_pair", "tile_url", "bounds", "created_at", "workspace_id")
)


def persist_dataset(db_session_factory, dataset) -> None:
    """Write a Dataset Pydantic model to the database as a DatasetRow."""
    session = db_session_factory()
    try:
        row = DatasetRow(
            id=dataset.id,
            filename=dataset.filename,
            dataset_type=dataset.dataset_type.value,
            format_pair=dataset.format_pair.value,
            tile_url=dataset.tile_url,
            bounds_json=json.dumps(dataset.bounds) if dataset.bounds else None,
            metadata_json=json.dumps({
                k: v for k, v in dataset.model_dump().items()
                if k not in _TOP_LEVEL_COLUMNS
            }, default=str),
            created_at=dataset.created_at,
            workspace_id=getattr(dataset, "workspace_id", None),
        )
        session.add(row)
        session.commit()
    finally:
        session.close()
