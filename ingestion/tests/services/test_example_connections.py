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


def test_seed_skips_when_pair_already_present_as_user_owned_row(db_session_factory):
    """Pre-existing user-owned connection with the same (url, type) blocks seeding."""
    from src.services import example_connections

    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="user-owned",
                name="User connection",
                url="https://example.org/sample.zarr",
                connection_type="zarr",
                workspace_id="userABCD",
                is_example=False,
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
        assert rows[0].id == "user-owned"
        assert rows[0].is_example is False
    finally:
        session.close()


def test_seed_skips_duplicate_url_type_pair_within_same_run(db_session_factory):
    """Two seeds with the same (url, connection_type) only insert one row."""
    from src.services import example_connections

    seeds = [
        example_connections.ExampleConnectionSeed(
            name="First",
            url="https://example.org/dup.zarr",
            connection_type="zarr",
            config={"variable": "t"},
        ),
        example_connections.ExampleConnectionSeed(
            name="Second",
            url="https://example.org/dup.zarr",
            connection_type="zarr",
            config={"variable": "t"},
        ),
    ]

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", seeds):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        rows = session.query(ConnectionRow).all()
        assert len(rows) == 1
        assert rows[0].name == "First"
    finally:
        session.close()


def test_seed_example_connections_is_wired_into_lifespan():
    """Verify _default_lifespan in app.py launches the example-connections seeder."""
    import inspect

    from src import app as app_module

    source = inspect.getsource(app_module._default_lifespan)
    assert "_seed_example_connections" in source, (
        "_default_lifespan must launch _seed_example_connections as a startup task"
    )


def test_curated_zarr_seed_is_well_formed():
    """Sanity check the live EXAMPLE_CONNECTIONS list before deploy."""
    from src.services.example_connections import EXAMPLE_CONNECTIONS

    if not EXAMPLE_CONNECTIONS:
        pytest.skip("No curated connections — seed mechanism shipped empty")

    for seed in EXAMPLE_CONNECTIONS:
        assert seed.name
        assert seed.url.startswith("https://")
        assert seed.connection_type in {"zarr", "cog", "pmtiles", "xyz_raster"}
        if seed.connection_type == "zarr":
            assert "variable" in seed.config
            if "timeDim" in seed.config and not seed.zarr_time_dim:
                assert isinstance(seed.config.get("timesteps"), list)
            if "rescaleMin" in seed.config:
                assert seed.config["rescaleMin"] < seed.config["rescaleMax"]
