"""Connection persistence model."""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, String

from src.models.base import Base


class ConnectionRow(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    connection_type = Column(
        String, nullable=False
    )  # xyz_raster, xyz_vector, cog, pmtiles
    bounds_json = Column(String, nullable=True)  # JSON array [w, s, e, n]
    min_zoom = Column(Integer, nullable=True)
    max_zoom = Column(Integer, nullable=True)
    tile_type = Column(String, nullable=True)  # "raster" or "vector"
    band_count = Column(Integer, nullable=True)
    rescale = Column(String, nullable=True)  # "min,max" for single-band COGs
    workspace_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

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
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
