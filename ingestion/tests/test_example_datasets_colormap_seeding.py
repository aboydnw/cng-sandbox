import json
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow
from src.services.example_datasets import backfill_example_colormaps
from src.services.source_coop_config import get_product, list_products


def test_gebco_product_declares_terrain_colormap():
    gebco = get_product("alexgleith/gebco-2024")
    assert gebco.preferred_colormap == "terrain"
    assert gebco.preferred_colormap_reversed is False


def test_products_without_preferred_colormap_default_to_none():
    any_other = next(
        p for p in list_products() if p.slug != "alexgleith/gebco-2024"
    )
    assert any_other.preferred_colormap is None
    assert any_other.preferred_colormap_reversed is None


def _insert_example_dataset(
    session, source_url: str, preferred_colormap=None, preferred_colormap_reversed=None
) -> str:
    ds_id = str(uuid.uuid4())
    row = DatasetRow(
        id=ds_id,
        filename="seeded",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="/raster/x/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
        workspace_id=None,
        is_example=True,
        bounds_json=json.dumps([-180.0, -90.0, 180.0, 90.0]),
        metadata_json=json.dumps({"source_url": source_url}),
        preferred_colormap=preferred_colormap,
        preferred_colormap_reversed=preferred_colormap_reversed,
    )
    session.add(row)
    session.commit()
    return ds_id


@pytest.fixture
def db_session_factory(db_engine):
    return sessionmaker(bind=db_engine)


def test_backfill_fills_null_preferred_colormap_on_existing_example(
    db_session_factory, db_session
):
    gebco = get_product("alexgleith/gebco-2024")
    ds_id = _insert_example_dataset(db_session, source_url=gebco.listing_url)

    backfill_example_colormaps(db_session_factory)

    refreshed = db_session.get(DatasetRow, ds_id)
    assert refreshed.preferred_colormap == "terrain"
    assert refreshed.preferred_colormap_reversed is False


def test_backfill_does_not_overwrite_non_null_preferred_colormap(
    db_session_factory, db_session
):
    gebco = get_product("alexgleith/gebco-2024")
    ds_id = _insert_example_dataset(
        db_session,
        source_url=gebco.listing_url,
        preferred_colormap="viridis",
        preferred_colormap_reversed=True,
    )

    backfill_example_colormaps(db_session_factory)

    refreshed = db_session.get(DatasetRow, ds_id)
    assert refreshed.preferred_colormap == "viridis"
    assert refreshed.preferred_colormap_reversed is True


def test_backfill_skips_examples_with_no_matching_product(
    db_session_factory, db_session
):
    ds_id = _insert_example_dataset(
        db_session, source_url="https://not-in-curated-list.example/"
    )

    backfill_example_colormaps(db_session_factory)

    refreshed = db_session.get(DatasetRow, ds_id)
    assert refreshed.preferred_colormap is None
    assert refreshed.preferred_colormap_reversed is None
