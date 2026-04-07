import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.services.duplicate_check import check_duplicate_filename


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def test_no_duplicate_returns_none(db_session):
    result = check_duplicate_filename(db_session, "test.tif", "workAAAA")
    assert result is None


def test_duplicate_returns_dataset_id(db_session):
    row = DatasetRow(
        id="existing-123",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff_cog",
        tile_url="/raster/tiles",
        workspace_id="workAAAA",
    )
    db_session.add(row)
    db_session.commit()

    result = check_duplicate_filename(db_session, "test.tif", "workAAAA")
    assert result == "existing-123"


def test_same_filename_different_workspace_returns_none(db_session):
    row = DatasetRow(
        id="existing-123",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff_cog",
        tile_url="/raster/tiles",
        workspace_id="workBBBB",
    )
    db_session.add(row)
    db_session.commit()

    result = check_duplicate_filename(db_session, "test.tif", "workAAAA")
    assert result is None
