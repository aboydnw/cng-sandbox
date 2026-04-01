from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

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


@pytest.mark.asyncio
async def test_deletes_old_rows_without_workspace(db_session):
    old = datetime.now(UTC) - timedelta(days=31)
    db_session.add(
        DatasetRow(
            id="old-orphan",
            filename="old.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/tiles/old",
            workspace_id=None,
            created_at=old,
        )
    )
    db_session.add(
        DatasetRow(
            id="new-orphan",
            filename="new.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/tiles/new",
            workspace_id=None,
            created_at=datetime.now(UTC),
        )
    )
    db_session.commit()

    with patch(
        "src.services.cleanup.delete_dataset", new_callable=AsyncMock
    ) as mock_delete:
        mock_delete.return_value = {"deleted": True, "affected_stories": []}
        deleted = await cleanup_expired_rows(db_session, ttl_days=30)

    assert "old-orphan" in deleted
    assert "new-orphan" not in deleted
    mock_delete.assert_called_once_with(db_session, "old-orphan", storage=None)


@pytest.mark.asyncio
async def test_preserves_workspace_rows_within_ttl(db_session):
    recent = datetime.now(UTC) - timedelta(days=10)
    db_session.add(
        DatasetRow(
            id="recent-ws",
            filename="r.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/tiles/r",
            workspace_id="abcd1234",
            created_at=recent,
        )
    )
    db_session.commit()

    with patch(
        "src.services.cleanup.delete_dataset", new_callable=AsyncMock
    ) as mock_delete:
        deleted = await cleanup_expired_rows(db_session, ttl_days=30)

    assert "recent-ws" not in deleted
    mock_delete.assert_not_called()


@pytest.mark.asyncio
async def test_deletes_expired_stories(db_session):
    old = datetime.now(UTC) - timedelta(days=31)
    db_session.add(
        StoryRow(
            id="old-story",
            title="Old",
            workspace_id=None,
            created_at=old,
        )
    )
    db_session.commit()

    with patch(
        "src.services.cleanup.delete_dataset", new_callable=AsyncMock
    ):
        deleted = await cleanup_expired_rows(db_session, ttl_days=30)

    assert "old-story" in deleted


@pytest.mark.asyncio
async def test_continues_on_delete_failure(db_session):
    old = datetime.now(UTC) - timedelta(days=31)
    db_session.add(
        DatasetRow(
            id="fail-ds",
            filename="fail.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/tiles/fail",
            workspace_id=None,
            created_at=old,
        )
    )
    db_session.add(
        DatasetRow(
            id="ok-ds",
            filename="ok.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/tiles/ok",
            workspace_id=None,
            created_at=old,
        )
    )
    db_session.commit()

    with patch(
        "src.services.cleanup.delete_dataset", new_callable=AsyncMock
    ) as mock_delete:
        mock_delete.side_effect = [
            RuntimeError("STAC unreachable"),
            {"deleted": True, "affected_stories": []},
        ]
        deleted = await cleanup_expired_rows(db_session, ttl_days=30)

    assert "fail-ds" not in deleted
    assert "ok-ds" in deleted
