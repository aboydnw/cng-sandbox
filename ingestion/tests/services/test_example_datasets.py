"""Tests for the example-datasets startup registration task."""

import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.services.example_datasets import (
    EXAMPLE_DATASET_NAMESPACE,
    example_dataset_id,
    migrate_example_dataset_ids,
    missing_example_products,
    ordered_products,
    register_example_datasets,
)


def _make_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine)


def test_ordered_products_puts_fast_products_first():
    """GEBCO and lg-land-carbon must appear before GHRSST."""
    slugs = [p.slug for p in ordered_products()]
    ghrsst_idx = slugs.index("ausantarctic/ghrsst-mur-v2")
    gebco_idx = slugs.index("alexgleith/gebco-2024")
    lg_idx = slugs.index("vizzuality/lg-land-carbon-data")
    assert gebco_idx < ghrsst_idx
    assert lg_idx < ghrsst_idx


def test_register_example_datasets_skips_already_registered():
    """A product whose source_url matches an existing example row is skipped."""
    _, factory = _make_db()
    session = factory()
    try:
        session.add(
            DatasetRow(
                id="preexisting",
                filename="GEBCO 2024 Bathymetry",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json='{"source_url": "https://data.source.coop/alexgleith/gebco-2024/"}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    enum_mock = AsyncMock(return_value=[])
    register_mock = AsyncMock(return_value="new-id")

    with (
        patch("src.services.example_datasets.run_enumerator", enum_mock),
        patch(
            "src.services.example_datasets.register_remote_collection",
            register_mock,
        ),
    ):
        asyncio.run(
            register_example_datasets(
                db_session_factory=factory,
                only_slugs={"alexgleith/gebco-2024"},
            )
        )

    register_mock.assert_not_awaited()
    enum_mock.assert_not_awaited()


def test_register_example_datasets_registers_missing():
    """A product with no existing example row triggers enumerate + register."""
    _, factory = _make_db()

    from src.services.enumerators import RemoteItem

    enum_mock = AsyncMock(
        return_value=[
            RemoteItem(
                href="https://example.com/x.tif",
                datetime=None,
                bbox=[-1.0, -1.0, 1.0, 1.0],
            )
        ]
    )
    register_mock = AsyncMock(return_value="new-id")

    with (
        patch("src.services.example_datasets.run_enumerator", enum_mock),
        patch(
            "src.services.example_datasets.register_remote_collection",
            register_mock,
        ),
    ):
        asyncio.run(
            register_example_datasets(
                db_session_factory=factory,
                only_slugs={"alexgleith/gebco-2024"},
            )
        )

    enum_mock.assert_awaited_once()
    register_mock.assert_awaited_once()
    assert register_mock.await_args.kwargs["is_example"] is True


def test_register_example_datasets_continues_after_product_failure():
    """One product failing does not stop the others."""
    _, factory = _make_db()

    enum_mock = AsyncMock(side_effect=RuntimeError("boom"))
    register_mock = AsyncMock(return_value="new-id")

    with (
        patch("src.services.example_datasets.run_enumerator", enum_mock),
        patch(
            "src.services.example_datasets.register_remote_collection",
            register_mock,
        ),
    ):
        asyncio.run(
            register_example_datasets(
                db_session_factory=factory,
                only_slugs={
                    "alexgleith/gebco-2024",
                    "vizzuality/lg-land-carbon-data",
                },
            )
        )

    assert enum_mock.await_count == 2
    register_mock.assert_not_awaited()


def test_missing_example_products_returns_unregistered():
    """missing_example_products reflects which listings are not yet persisted."""
    _, factory = _make_db()

    assert len(missing_example_products(factory)) == len(ordered_products())

    session = factory()
    try:
        session.add(
            DatasetRow(
                id="already",
                filename="GEBCO 2024",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json='{"source_url": "https://data.source.coop/alexgleith/gebco-2024/"}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    missing_slugs = {p.slug for p in missing_example_products(factory)}
    assert "alexgleith/gebco-2024" not in missing_slugs


def test_register_example_datasets_dispatches_pmtiles():
    _, factory = _make_db()

    from src.services.source_coop_config import SourceCoopProduct

    fake_product = SourceCoopProduct(
        slug="test/pmt",
        name="test pmtiles",
        description="d",
        listing_url="https://data.source.coop/test/pmt/",
        kind="pmtiles",
        pmtiles_url="https://data.source.coop/test/pmt/x.pmtiles",
    )

    pmtiles_register_mock = AsyncMock(return_value="pmt-id")

    with (
        patch(
            "src.services.example_datasets.ordered_products",
            return_value=[fake_product],
        ),
        patch(
            "src.services.example_datasets.register_pmtiles_example",
            pmtiles_register_mock,
        ),
    ):
        asyncio.run(
            register_example_datasets(
                db_session_factory=factory,
                only_slugs={"test/pmt"},
            )
        )

    pmtiles_register_mock.assert_awaited_once()
    assert pmtiles_register_mock.await_args.args[0].slug == "test/pmt"


def test_example_dataset_id_is_deterministic_uuid5():
    import uuid

    url = "https://data.source.coop/alexgleith/gebco-2024/"
    expected = str(uuid.uuid5(EXAMPLE_DATASET_NAMESPACE, url))
    assert example_dataset_id(url) == expected
    assert example_dataset_id(url) == example_dataset_id(url)


def test_example_dataset_id_differs_per_source_url():
    a = example_dataset_id("https://data.source.coop/a/")
    b = example_dataset_id("https://data.source.coop/b/")
    assert a != b


def test_migrate_example_dataset_ids_renames_legacy_random_ids():
    _, factory = _make_db()
    url = "https://data.source.coop/alexgleith/gebco-2024/"
    legacy_id = "random-legacy-id"
    session = factory()
    try:
        session.add(
            DatasetRow(
                id=legacy_id,
                filename="GEBCO",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url=f"/raster/sandbox-{legacy_id}",
                metadata_json=f'{{"source_url": "{url}"}}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    renamed = migrate_example_dataset_ids(factory)
    assert renamed == 1

    session = factory()
    try:
        rows = session.query(DatasetRow).all()
        assert len(rows) == 1
        assert rows[0].id == example_dataset_id(url)
        # tile_url is preserved — it points to the original sandbox-<legacy-id>
        # pgSTAC collection and continues to function.
        assert rows[0].tile_url == f"/raster/sandbox-{legacy_id}"
    finally:
        session.close()


def test_migrate_example_dataset_ids_is_idempotent():
    _, factory = _make_db()
    url = "https://data.source.coop/alexgleith/gebco-2024/"
    session = factory()
    try:
        session.add(
            DatasetRow(
                id="legacy",
                filename="GEBCO",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json=f'{{"source_url": "{url}"}}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    assert migrate_example_dataset_ids(factory) == 1
    assert migrate_example_dataset_ids(factory) == 0


def test_migrate_example_dataset_ids_skips_non_example_rows():
    _, factory = _make_db()
    url = "https://data.source.coop/foo/bar/"
    session = factory()
    try:
        session.add(
            DatasetRow(
                id="user-row",
                filename="user upload",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json=f'{{"source_url": "{url}"}}',
                is_example=False,
                workspace_id="ws",
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    assert migrate_example_dataset_ids(factory) == 0
    session = factory()
    try:
        row = session.query(DatasetRow).one()
        assert row.id == "user-row"
    finally:
        session.close()


def test_migrate_example_dataset_ids_skips_when_target_already_present():
    """A pre-existing row at the deterministic ID is not overwritten."""
    _, factory = _make_db()
    url = "https://data.source.coop/alexgleith/gebco-2024/"
    target = example_dataset_id(url)
    session = factory()
    try:
        session.add(
            DatasetRow(
                id=target,
                filename="GEBCO (canonical)",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t/canonical",
                metadata_json=f'{{"source_url": "{url}"}}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            DatasetRow(
                id="duplicate-legacy",
                filename="GEBCO (legacy)",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t/legacy",
                metadata_json=f'{{"source_url": "{url}"}}',
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    renamed = migrate_example_dataset_ids(factory)
    assert renamed == 0
    session = factory()
    try:
        ids = {r.id for r in session.query(DatasetRow).all()}
        assert ids == {target, "duplicate-legacy"}
    finally:
        session.close()
