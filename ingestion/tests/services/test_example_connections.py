"""Unit tests for the example-connections seeding service."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from src.models.base import Base
from src.models.connection import ConnectionRow


@pytest.fixture
def db_session_factory(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(f"sqlite:///{tmp_path}/test.db")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def _sample_seeds():
    from src.services.example_connections import ExampleConnectionSeed

    return [
        ExampleConnectionSeed(
            name="Sample Zarr",
            url="https://example.org/sample.zarr",
            connection_type="zarr",
            config={
                "variable": "t",
                "timeDim": "time",
                "timeValues": ["2024-01-01T00:00:00Z"],
                "rescaleMin": 0.0,
                "rescaleMax": 1.0,
            },
        ),
    ]


def test_seed_inserts_missing_example_connection(db_session_factory):
    from src.services import example_connections

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", _sample_seeds()):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        rows = session.query(ConnectionRow).all()
        assert len(rows) == 1
        row = rows[0]
        assert row.url == "https://example.org/sample.zarr"
        assert row.connection_type == "zarr"
        assert row.is_example is True
        assert row.workspace_id is None
        assert row.config["variable"] == "t"
    finally:
        session.close()


def test_seed_is_idempotent_on_repeated_runs(db_session_factory):
    from src.services import example_connections

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", _sample_seeds()):
        example_connections.seed_example_connections(db_session_factory)
        example_connections.seed_example_connections(db_session_factory)
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        assert session.query(ConnectionRow).count() == 1
    finally:
        session.close()


def test_seed_skips_when_url_type_pair_already_present(db_session_factory):
    from src.services import example_connections

    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="pre-existing",
                name="Pre-existing",
                url="https://example.org/sample.zarr",
                connection_type="zarr",
                workspace_id=None,
                is_example=True,
            )
        )
        session.commit()
    finally:
        session.close()

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", _sample_seeds()):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        rows = session.query(ConnectionRow).all()
        assert len(rows) == 1
        assert rows[0].id == "pre-existing"
    finally:
        session.close()
