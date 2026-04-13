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
