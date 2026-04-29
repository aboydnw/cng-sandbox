"""Connection persistence model."""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from src.models.base import Base


class ConnectionRow(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    connection_type = Column(String, nullable=False)
    bounds_json = Column(String, nullable=True)  # JSON array [w, s, e, n]
    min_zoom = Column(Integer, nullable=True)
    max_zoom = Column(Integer, nullable=True)
    tile_type = Column(String, nullable=True)  # "raster" or "vector"
    band_count = Column(Integer, nullable=True)
    rescale = Column(String, nullable=True)  # "min,max" for single-band COGs
    workspace_id = Column(String, nullable=True)
    is_categorical = Column(Boolean, nullable=False, default=False)
    categories_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    tile_url = Column(String, nullable=True)
    render_path = Column(String, nullable=True)  # "client" | "server"
    conversion_status = Column(
        String, nullable=True
    )  # pending | running | ready | failed
    conversion_error = Column(Text, nullable=True)
    feature_count = Column(Integer, nullable=True)
    file_size = Column(BigInteger, nullable=True)
    is_shared = Column(Boolean, nullable=False, default=False)
    render_mode = Column(String, nullable=True)
    preferred_colormap = Column(String, nullable=True)
    preferred_colormap_reversed = Column(Boolean, nullable=True)
    config = Column(JSON, nullable=True)

    def to_dict(self) -> dict:
        """Convert to the Connection API response format."""
        bounds = json.loads(self.bounds_json) if self.bounds_json else None
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "connection_type": self.connection_type,
            "bounds": bounds,
            "min_zoom": self.min_zoom,
            "max_zoom": self.max_zoom,
            "tile_type": self.tile_type,
            "band_count": self.band_count,
            "rescale": self.rescale,
            "workspace_id": self.workspace_id,
            "is_categorical": self.is_categorical,
            "categories": json.loads(self.categories_json)
            if self.categories_json
            else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "tile_url": self.tile_url,
            "render_path": self.render_path,
            "conversion_status": self.conversion_status,
            "conversion_error": self.conversion_error,
            "feature_count": self.feature_count,
            "file_size": self.file_size,
            "is_shared": bool(self.is_shared),
            "render_mode": self.render_mode,
            "preferred_colormap": self.preferred_colormap,
            "preferred_colormap_reversed": (
                None
                if self.preferred_colormap_reversed is None
                else bool(self.preferred_colormap_reversed)
            ),
            "config": self.config,
        }
