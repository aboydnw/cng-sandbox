import shutil

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models import Job, JobStatus
from src.models.base import Base
from src.models.dataset import DatasetRow
from src.services import pointcloud_pipeline

requires_pdal = pytest.mark.skipif(
    shutil.which("pdal") is None,
    reason="pdal CLI not installed on host",
)


@pytest.fixture
def db_session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)
    engine.dispose()


def _load_dataset(db_session_factory, dataset_id: str) -> dict:
    session = db_session_factory()
    try:
        row = session.get(DatasetRow, dataset_id)
        return row.to_dict()
    finally:
        session.close()


def test_scan_las_header_reads_point_count_bounds_crs():
    scan = pointcloud_pipeline.scan_las_header("tests/fixtures/tiny.laz")
    assert scan.point_count > 0
    assert len(scan.native_bounds) == 4
    assert scan.crs is not None


def test_scan_las_header_none_crs_when_missing():
    scan = pointcloud_pipeline.scan_las_header("tests/fixtures/tiny_nocrs.laz")
    assert scan.crs is None
