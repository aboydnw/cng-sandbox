import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.services.pmtiles_header import PMTilesHeader, PMTilesHeaderError
from src.services.pmtiles_register import (
    PMTilesRegistrationError,
    register_pmtiles_example,
)
from src.services.source_coop_config import SourceCoopProduct


def _make_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def _product() -> SourceCoopProduct:
    return SourceCoopProduct(
        slug="test/vida",
        name="Global Buildings (VIDA)",
        description="Combined Google, Microsoft, and OSM building footprints.",
        listing_url="https://data.source.coop/test/vida/",
        kind="pmtiles",
        pmtiles_url="https://data.source.coop/test/vida/buildings.pmtiles",
    )


def test_register_pmtiles_example_persists_dataset_row():
    factory = _make_db()
    header = PMTilesHeader(
        version=3,
        tile_type=1,
        min_zoom=0,
        max_zoom=14,
        bounds=(-180.0, -85.0, 180.0, 85.0),
    )

    with patch(
        "src.services.pmtiles_register.read_pmtiles_header",
        AsyncMock(return_value=header),
    ):
        dataset_id = asyncio.run(register_pmtiles_example(_product(), factory))

    session = factory()
    try:
        row = session.query(DatasetRow).filter(DatasetRow.id == dataset_id).one()
    finally:
        session.close()

    assert row.format_pair == "pmtiles"
    assert row.dataset_type == "vector"
    assert row.tile_url == "https://data.source.coop/test/vida/buildings.pmtiles"
    assert row.is_example is True
    assert row.workspace_id is None

    meta = json.loads(row.metadata_json)
    assert meta["is_zero_copy"] is True
    assert meta["source_url"] == "https://data.source.coop/test/vida/"
    assert meta["min_zoom"] == 0
    assert meta["max_zoom"] == 14
    assert meta["credits"], "expected credits list"


def test_register_pmtiles_example_raises_when_header_probe_fails():
    factory = _make_db()

    with (
        patch(
            "src.services.pmtiles_register.read_pmtiles_header",
            AsyncMock(side_effect=PMTilesHeaderError("bad magic")),
        ),
        pytest.raises(PMTilesRegistrationError),
    ):
        asyncio.run(register_pmtiles_example(_product(), factory))


def test_register_pmtiles_example_rejects_non_pmtiles_product():
    factory = _make_db()
    mosaic_product = SourceCoopProduct(
        slug="test/mosaic",
        name="mosaic",
        description="d",
        listing_url="https://data.source.coop/test/mosaic/",
        enumerator="path_listing",
    )
    with pytest.raises(PMTilesRegistrationError):
        asyncio.run(register_pmtiles_example(mosaic_product, factory))
