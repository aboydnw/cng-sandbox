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


def test_imerg_seed_has_geozarr_attrs(monkeypatch, db_session_factory):
    from src.services import example_connections

    monkeypatch.setattr(
        example_connections,
        "_probe_zarr_timesteps",
        lambda *args, **kwargs: [],
    )
    example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        row = (
            session.query(ConnectionRow)
            .filter(ConnectionRow.url.like("%imerg_final.zarr%"))
            .one()
        )
        assert row.geozarr_attrs == {
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        }
    finally:
        session.close()


def test_curated_zarr_seed_is_well_formed():
    """Sanity check the live EXAMPLE_CONNECTIONS list before deploy."""
    from src.services.example_connections import EXAMPLE_CONNECTIONS

    if not EXAMPLE_CONNECTIONS:
        pytest.skip("No curated connections — seed mechanism shipped empty")

    for seed in EXAMPLE_CONNECTIONS:
        assert seed.name
        assert seed.url.startswith("https://")
        assert seed.connection_type in {
            "zarr",
            "cog",
            "pmtiles",
            "xyz_raster",
            "copc",
        }
        if seed.connection_type == "zarr":
            assert "variable" in seed.config
            if "timeDim" in seed.config and not seed.zarr_time_dim:
                assert isinstance(seed.config.get("timesteps"), list)
            if "rescaleMin" in seed.config:
                assert seed.config["rescaleMin"] < seed.config["rescaleMax"]
            if "extraDim" in seed.config:
                assert isinstance(seed.config["extraDim"], str)
                assert isinstance(seed.config.get("extraIndex"), int)


def test_seed_backfills_geozarr_attrs_on_existing_example_row(db_session_factory):
    """Existing is_example=True row missing geozarr_attrs gets backfilled."""
    from src.services import example_connections

    seed = example_connections.ExampleConnectionSeed(
        name="Backfill target",
        url="https://example.org/backfill.zarr",
        connection_type="zarr",
        config={"variable": "t"},
        bounds=[-10.0, -20.0, 10.0, 20.0],
        rescale="0,1",
        preferred_colormap="viridis",
        preferred_colormap_reversed=True,
        geozarr_attrs={
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        },
    )

    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="legacy-row",
                name="Legacy name",
                url=seed.url,
                connection_type=seed.connection_type,
                workspace_id=None,
                is_example=True,
                config={"variable": "t", "timesteps": [{"datetime": "x", "index": 0}]},
            )
        )
        session.commit()
    finally:
        session.close()

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", [seed]):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        row = session.query(ConnectionRow).one()
        assert row.id == "legacy-row"
        assert row.geozarr_attrs == seed.geozarr_attrs
        assert row.preferred_colormap == "viridis"
        assert row.preferred_colormap_reversed is True
        assert row.rescale == "0,1"
        assert row.bounds_json is not None
        # Curator-edited fields and runtime-probed config preserved
        assert row.name == "Legacy name"
        assert row.config == {
            "variable": "t",
            "timesteps": [{"datetime": "x", "index": 0}],
        }
    finally:
        session.close()


def test_seed_does_not_clobber_set_curated_fields(db_session_factory):
    """Backfill only fills NULL values; never overwrites operator-set values."""
    from src.services import example_connections

    seed = example_connections.ExampleConnectionSeed(
        name="No clobber",
        url="https://example.org/clobber.zarr",
        connection_type="zarr",
        config={"variable": "t"},
        preferred_colormap="viridis",
        geozarr_attrs={
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        },
    )

    operator_attrs = {
        "spatial:dimensions": ["y", "x"],
        "spatial:transform": [1, 0, 0, 0, 1, 0],
        "spatial:shape": [10, 10],
        "proj:code": "EPSG:3857",
    }
    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="curated",
                name="Curated",
                url=seed.url,
                connection_type=seed.connection_type,
                workspace_id=None,
                is_example=True,
                preferred_colormap="magma",
                geozarr_attrs=operator_attrs,
            )
        )
        session.commit()
    finally:
        session.close()

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", [seed]):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        row = session.query(ConnectionRow).one()
        assert row.preferred_colormap == "magma"
        assert row.geozarr_attrs == operator_attrs
    finally:
        session.close()


def test_seed_never_touches_user_owned_row(db_session_factory):
    """User-owned rows with the same (url, type) are never modified."""
    from src.services import example_connections

    seed = example_connections.ExampleConnectionSeed(
        name="Skip user row",
        url="https://example.org/user.zarr",
        connection_type="zarr",
        config={"variable": "t"},
        preferred_colormap="viridis",
    )

    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="user-row",
                name="User connection",
                url=seed.url,
                connection_type=seed.connection_type,
                workspace_id="userABCD",
                is_example=False,
                preferred_colormap=None,
            )
        )
        session.commit()
    finally:
        session.close()

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", [seed]):
        example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        row = session.query(ConnectionRow).one()
        assert row.id == "user-row"
        assert row.workspace_id == "userABCD"
        assert row.is_example is False
        assert row.preferred_colormap is None
    finally:
        session.close()


def test_seed_skips_time_probe_for_existing_rows(monkeypatch, db_session_factory):
    """Existing rows must not trigger a network probe — startup stays cheap."""
    from src.services import example_connections

    seed = example_connections.ExampleConnectionSeed(
        name="Probed seed",
        url="https://example.org/probed.zarr",
        connection_type="zarr",
        config={"variable": "t", "timeDim": "time"},
        zarr_time_dim="time",
        geozarr_attrs={
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        },
    )

    session = db_session_factory()
    try:
        session.add(
            ConnectionRow(
                id="legacy",
                name="Legacy",
                url=seed.url,
                connection_type=seed.connection_type,
                workspace_id=None,
                is_example=True,
                config={
                    "variable": "t",
                    "timeDim": "time",
                    "timesteps": [{"datetime": "2024-01-01T00:00:00Z", "index": 0}],
                },
            )
        )
        session.commit()
    finally:
        session.close()

    calls = []

    def fake_probe(*args, **kwargs):
        calls.append((args, kwargs))
        return []

    monkeypatch.setattr(example_connections, "_probe_zarr_timesteps", fake_probe)

    with patch.object(example_connections, "EXAMPLE_CONNECTIONS", [seed]):
        example_connections.seed_example_connections(db_session_factory)

    assert calls == []


def test_autzen_copc_seed_is_registered(monkeypatch, db_session_factory):
    from src.services import example_connections

    monkeypatch.setattr(
        example_connections,
        "_probe_zarr_timesteps",
        lambda *args, **kwargs: [],
    )
    example_connections.seed_example_connections(db_session_factory)

    session = db_session_factory()
    try:
        row = (
            session.query(ConnectionRow)
            .filter(ConnectionRow.connection_type == "copc")
            .one()
        )
        assert row.is_example is True
        assert row.workspace_id is None
        assert "autzen" in row.url
        assert row.config["color_mode"] == "elevation"
    finally:
        session.close()


def test_ftw_predictions_seed_has_inlined_4d_config():
    """The Fields of The World seed must inline timesteps and pin a band."""
    from src.services.example_connections import EXAMPLE_CONNECTIONS

    ftw = next((s for s in EXAMPLE_CONNECTIONS if "ftw/global-data" in s.url), None)
    if ftw is None:
        pytest.skip("Fields of The World seed not present")

    assert ftw.zarr_time_dim is None
    assert ftw.config["variable"] == "variables"
    assert ftw.config["timeDim"] == "time"
    assert ftw.config["extraDim"] == "band"
    assert ftw.config["extraIndex"] == 1
    timesteps = ftw.config["timesteps"]
    assert len(timesteps) == 2
    assert timesteps[0]["index"] == 0
    assert timesteps[-1]["index"] == 1
    assert ftw.geozarr_attrs is not None
    assert ftw.geozarr_attrs["proj:code"] == "EPSG:4326"
