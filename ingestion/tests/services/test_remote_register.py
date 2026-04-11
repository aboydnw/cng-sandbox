from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models import Job
from src.services.enumerators import RemoteItem
from src.services.remote_register import (
    RemoteRegistrationError,
    register_remote_collection,
)
from src.services.source_coop_config import SourceCoopProduct


@pytest.fixture
def fake_product():
    return SourceCoopProduct(
        slug="test/product",
        name="Test Product",
        description="Test",
        listing_url="https://data.source.coop/test/product/",
        enumerator="path_listing",
        enumerator_args={},
        is_temporal=False,
    )


@pytest.fixture
def fake_temporal_product():
    return SourceCoopProduct(
        slug="test/temporal",
        name="Test Temporal",
        description="Test temporal",
        listing_url="https://data.source.coop/test/temporal/",
        enumerator="stac_sidecars",
        enumerator_args={"recursive": True},
        is_temporal=True,
    )


@pytest.mark.asyncio
async def test_register_non_temporal_product_probes_missing_bounds(fake_product):
    items = [
        RemoteItem(
            href="https://data.source.coop/test/product/a.tif",
            datetime=None,
            bbox=None,
        ),
        RemoteItem(
            href="https://data.source.coop/test/product/b.tif",
            datetime=None,
            bbox=[-5.0, -5.0, 5.0, 5.0],
        ),
    ]
    db_session_factory = MagicMock()
    job = Job(filename="test")
    job.workspace_id = "deadbeef"

    fake_bounds = ([-10.0, -10.0, 10.0, 10.0], {"type": "Polygon", "coordinates": []})
    fake_band_meta = (3, ["b1", "b2", "b3"], ["red", "green", "blue"], "uint8")

    with (
        patch(
            "src.services.remote_register.read_remote_bounds",
            new=AsyncMock(return_value=fake_bounds),
        ),
        patch(
            "src.services.remote_register.stac_ingest.ingest_mosaic_raster",
            new=AsyncMock(
                return_value="http://tiler/collections/sandbox-xyz/{z}/{x}/{y}"
            ),
        ),
        patch(
            "src.services.remote_register._read_band_meta",
            new=AsyncMock(return_value=fake_band_meta),
        ),
        patch("src.services.remote_register.persist_dataset") as persist_mock,
    ):
        dataset_id = await register_remote_collection(
            job=job,
            product=fake_product,
            items=items,
            db_session_factory=db_session_factory,
        )

    assert dataset_id == job.dataset_id
    persist_mock.assert_called_once()
    dataset = persist_mock.call_args.args[1]
    assert dataset.is_zero_copy is True
    assert dataset.is_temporal is False
    assert dataset.source_url == "https://data.source.coop/test/product/"
    assert dataset.workspace_id == "deadbeef"


@pytest.mark.asyncio
async def test_register_temporal_product_orders_by_datetime(fake_temporal_product):
    dt_early = datetime(2024, 1, 1, tzinfo=UTC)
    dt_late = datetime(2024, 2, 1, tzinfo=UTC)

    items = [
        RemoteItem(
            href="https://data.source.coop/test/temporal/late.tif",
            datetime=dt_late,
            bbox=[-1.0, -1.0, 1.0, 1.0],
        ),
        RemoteItem(
            href="https://data.source.coop/test/temporal/early.tif",
            datetime=dt_early,
            bbox=[-1.0, -1.0, 1.0, 1.0],
        ),
    ]
    db_session_factory = MagicMock()
    job = Job(filename="test")
    job.workspace_id = "deadbeef"

    fake_band_meta = (1, ["sst"], ["gray"], "float32")

    with (
        patch(
            "src.services.remote_register.stac_ingest.ingest_mosaic_raster",
            new=AsyncMock(return_value="http://tiler/sandbox-xyz/{z}/{x}/{y}"),
        ) as ingest_mock,
        patch(
            "src.services.remote_register._read_band_meta",
            new=AsyncMock(return_value=fake_band_meta),
        ),
        patch("src.services.remote_register.persist_dataset") as persist_mock,
    ):
        await register_remote_collection(
            job=job,
            product=fake_temporal_product,
            items=items,
            db_session_factory=db_session_factory,
        )

    call_kwargs = ingest_mock.call_args.kwargs
    assert call_kwargs["hrefs"][0].endswith("early.tif")
    assert call_kwargs["hrefs"][1].endswith("late.tif")
    assert call_kwargs["datetimes"][0].startswith("2024-01-01")
    assert call_kwargs["datetimes"][1].startswith("2024-02-01")

    dataset = persist_mock.call_args.args[1]
    assert dataset.is_temporal is True
    assert len(dataset.timesteps) == 2


@pytest.mark.asyncio
async def test_register_raises_when_no_items(fake_product):
    with pytest.raises(RemoteRegistrationError, match="no items"):
        await register_remote_collection(
            job=Job(filename="test"),
            product=fake_product,
            items=[],
            db_session_factory=MagicMock(),
        )
