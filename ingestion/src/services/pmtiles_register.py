"""Register a source.coop PMTiles product as a zero-copy example dataset."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import sessionmaker

from src.models import Dataset, DatasetType, FormatPair
from src.models.dataset import persist_dataset
from src.services.pipeline import get_credits
from src.services.pmtiles_header import PMTilesHeaderError, read_pmtiles_header
from src.services.source_coop_config import SourceCoopProduct

logger = logging.getLogger(__name__)


class PMTilesRegistrationError(Exception):
    pass


async def register_pmtiles_example(
    product: SourceCoopProduct,
    db_session_factory: sessionmaker,
) -> str:
    """Register a kind="pmtiles" product as an is_example=True dataset row.

    Returns the new dataset ID. Raises PMTilesRegistrationError on any
    probe/parse/persist failure.
    """
    if product.kind != "pmtiles" or not product.pmtiles_url:
        raise PMTilesRegistrationError(
            f"{product.slug}: register_pmtiles_example requires kind='pmtiles' and pmtiles_url"
        )

    try:
        header = await read_pmtiles_header(product.pmtiles_url)
    except PMTilesHeaderError as exc:
        raise PMTilesRegistrationError(
            f"{product.slug}: header probe failed: {exc}"
        ) from exc
    except Exception as exc:
        raise PMTilesRegistrationError(
            f"{product.slug}: header fetch failed: {exc}"
        ) from exc

    dataset_id = str(uuid.uuid4())
    dataset = Dataset(
        id=dataset_id,
        filename=product.name,
        dataset_type=DatasetType.VECTOR,
        format_pair=FormatPair.PMTILES,
        tile_url=product.pmtiles_url,
        bounds=list(header.bounds),
        min_zoom=header.min_zoom,
        max_zoom=header.max_zoom,
        validation_results=[],
        credits=get_credits(FormatPair.PMTILES),
        is_temporal=False,
        timesteps=[],
        source_url=product.listing_url,
        workspace_id=None,
        is_example=True,
        is_zero_copy=True,
        created_at=datetime.now(UTC),
    )

    try:
        persist_dataset(db_session_factory, dataset)
    except Exception as exc:
        raise PMTilesRegistrationError(
            f"{product.slug}: persist failed: {exc}"
        ) from exc

    logger.info("registered pmtiles example dataset %s (%s)", product.slug, dataset_id)
    return dataset_id
