"""Story persistence model and API schemas."""

import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, String, Text

from src.models.base import Base


class StoryRow(Base):
    __tablename__ = "stories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="Untitled story")
    description = Column(String, nullable=True)
    dataset_id = Column(String, nullable=True)
    chapters_json = Column(Text, nullable=False, default="[]")
    published = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    workspace_id = Column(String, nullable=True)


class ChapterPayload(BaseModel):
    id: str
    order: int
    type: str = "scrollytelling"
    title: str
    narrative: str
    map_state: dict
    transition: str = "fly-to"
    overlay_position: Literal["left", "right"] = "left"
    layer_config: dict | None = None


class StoryCreate(BaseModel):
    title: str = "Untitled story"
    description: str | None = None
    dataset_id: str | None = None
    chapters: list[ChapterPayload] = []
    published: bool = False


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    chapters: list[ChapterPayload] | None = None
    published: bool | None = None


class StoryResponse(BaseModel):
    id: str
    title: str
    description: str | None
    dataset_id: str | None
    dataset_ids: list[str]
    chapters: list[ChapterPayload]
    published: bool
    created_at: str
    updated_at: str
