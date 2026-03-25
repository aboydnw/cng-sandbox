from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.cleanup import cleanup_expired_rows


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_deletes_old_rows_without_workspace(db_session):
    old = datetime.now(timezone.utc) - timedelta(days=31)
    db_session.add(DatasetRow(
        id="old-orphan", filename="old.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/old",
        workspace_id=None, created_at=old,
    ))
    db_session.add(DatasetRow(
        id="new-orphan", filename="new.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/new",
        workspace_id=None, created_at=datetime.now(timezone.utc),
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "old-orphan" in deleted
    assert "new-orphan" not in deleted


def test_preserves_workspace_rows_within_ttl(db_session):
    recent = datetime.now(timezone.utc) - timedelta(days=10)
    db_session.add(DatasetRow(
        id="recent-ws", filename="r.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/r",
        workspace_id="abcd1234", created_at=recent,
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "recent-ws" not in deleted


def test_deletes_expired_stories(db_session):
    old = datetime.now(timezone.utc) - timedelta(days=31)
    db_session.add(StoryRow(
        id="old-story", title="Old", workspace_id=None, created_at=old,
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "old-story" in deleted
