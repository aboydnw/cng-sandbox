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

    def to_dict(self) -> dict:
        """Convert to the Dataset API response format."""
        meta = json.loads(self.metadata_json) if self.metadata_json else {}
        bounds = json.loads(self.bounds_json) if self.bounds_json else None
        return {
            "id": self.id,
            "filename": self.filename,
            "dataset_type": self.dataset_type,
            "format_pair": self.format_pair,
            "tile_url": self.tile_url,
            "bounds": bounds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            **meta,
        }
