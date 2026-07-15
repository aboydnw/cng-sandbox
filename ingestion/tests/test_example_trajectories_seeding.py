import pytest
from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow
from src.services.example_datasets import (
    example_dataset_id,
    seed_example_trajectories,
)
from src.services.example_trajectory_source import STORK_SOURCE_URL


@pytest.fixture
def db_session_factory(db_engine):
    return sessionmaker(bind=db_engine)


def test_seed_example_trajectory_inserts_master_row(db_session_factory, db_session):
    seed_example_trajectories(db_session_factory, artifact_exists=lambda _key: True)

    det_id = example_dataset_id(STORK_SOURCE_URL)
    row = db_session.get(DatasetRow, det_id)
    assert row is not None
    assert row.is_example is True
    assert row.workspace_id is None
    assert row.dataset_type == "trajectory"

    d = row.to_dict()
    assert d["trips_url"] == f"/storage/datasets/{det_id}/converted/trips.json"
    assert d["source_url"] == STORK_SOURCE_URL


def test_seed_example_trajectory_is_idempotent(db_session_factory, db_session):
    def exists(_key):
        return True

    seed_example_trajectories(db_session_factory, artifact_exists=exists)
    seed_example_trajectories(db_session_factory, artifact_exists=exists)

    rows = db_session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).all()
    assert len([r for r in rows if r.dataset_type == "trajectory"]) == 1


def test_seed_example_trajectory_skips_unpublished_artifact(
    db_session_factory, db_session, caplog
):
    seed_example_trajectories(db_session_factory, artifact_exists=lambda _key: False)

    det_id = example_dataset_id(STORK_SOURCE_URL)
    assert db_session.get(DatasetRow, det_id) is None
    assert "artifact is not published" in caplog.text
