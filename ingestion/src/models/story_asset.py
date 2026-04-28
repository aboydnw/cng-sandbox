"""Story asset persistence model (uploaded images and CSVs attached to stories)."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from src.models.base import Base


class StoryAssetRow(Base):
    __tablename__ = "story_assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, nullable=True)
    story_id = Column(String, nullable=True)
    kind = Column(String, nullable=False)
    original_key = Column(String, nullable=False)
    thumbnail_key = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    mime = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    row_count = Column(Integer, nullable=True)
    columns_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
