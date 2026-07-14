"""Startup task: register source.coop curated products as example datasets.

On ingestion boot the service:
    1. Iterates curated products in fast-first order (fast rasters before
       slow temporal mosaics) so that a first visitor to a fresh deploy
       never sees an empty gallery.
    2. Skips any product whose listing_url is already present on an
       is_example=True dataset row (idempotent across restarts).
    3. Enumerates and registers the rest, isolating failures per product.

The task runs in the background from the FastAPI lifespan; service start
does not wait for it to finish.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import sessionmaker

from src.models import FormatPair, Job
from src.models.dataset import DatasetRow
from src.services.example_trajectory_source import (
    STORK_ATTRIBUTION,
    STORK_SOURCE_URL,
    STORK_TITLE,
)
from src.services.enumerators import RemoteItem
from src.services.enumerators.maxar import enumerate_maxar_event
from src.services.enumerators.path_listing import enumerate_path_listing
from src.services.enumerators.single_cog import enumerate_single_cog
from src.services.enumerators.stac_sidecars import enumerate_stac_sidecars
from src.services.pmtiles_register import (
    PMTilesRegistrationError,
    register_pmtiles_example,
)
from src.services.remote_register import (
    RemoteRegistrationError,
    register_remote_collection,
)
from src.services.source_coop_config import SourceCoopProduct, list_products

logger = logging.getLogger(__name__)


# Stable namespace for deriving deterministic example-dataset IDs from their
# source.coop listing URL. Changing this value would orphan every example
# dataset row and every story chapter that references one — don't.
EXAMPLE_DATASET_NAMESPACE = uuid.UUID("9d8b0d3c-3b1c-4f3a-9d70-1b6d5c8a4f8f")


def example_dataset_id(source_url: str) -> str:
    """Return the deterministic UUID an example dataset MUST use.

    Derived as ``uuid5(EXAMPLE_DATASET_NAMESPACE, source_url)`` so that
    re-seeding after a database wipe produces the same dataset IDs and any
    stories or forks that reference them keep resolving.
    """
    return str(uuid.uuid5(EXAMPLE_DATASET_NAMESPACE, source_url))


async def run_enumerator(product: SourceCoopProduct) -> list[RemoteItem]:
    """Dispatch to the enumerator named in the product config."""
    if product.enumerator == "path_listing":
        return await enumerate_path_listing(
            listing_url=product.listing_url,
            filenames=product.enumerator_args.get("filenames"),
        )
    if product.enumerator == "stac_sidecars":
        return await enumerate_stac_sidecars(
            listing_url=product.listing_url,
            recursive=product.enumerator_args.get("recursive", False),
            start_prefix=product.enumerator_args.get("start_prefix", ""),
        )
    if product.enumerator == "maxar_event":
        return await enumerate_maxar_event(
            product.listing_url,
            max_items=product.enumerator_args.get("max_items"),
            min_date=product.enumerator_args.get("min_date"),
            max_date=product.enumerator_args.get("max_date"),
        )
    if product.enumerator == "single_cog":
        return await enumerate_single_cog(product.listing_url)
    raise ValueError(f"Unknown enumerator: {product.enumerator}")


def ordered_products() -> list[SourceCoopProduct]:
    """Return curated products in fast-first order.

    Non-temporal products register first (they are single COGs or small
    path-listed mosaics). Temporal products go last because enumerating
    thousands of STAC sidecars is slow.
    """
    all_products = list_products()
    fast = [p for p in all_products if not p.is_temporal]
    slow = [p for p in all_products if p.is_temporal]
    return fast + slow


def missing_example_products(
    db_session_factory: sessionmaker,
) -> list[SourceCoopProduct]:
    """Return curated products not yet registered as example datasets."""
    already = _existing_example_source_urls(db_session_factory)
    return [p for p in ordered_products() if p.listing_url not in already]


def _existing_example_source_urls(db_session_factory: sessionmaker) -> set[str]:
    """Return the set of source.coop listing URLs already registered as examples."""
    session = db_session_factory()
    try:
        rows = session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).all()
        urls: set[str] = set()
        for row in rows:
            meta = json.loads(row.metadata_json) if row.metadata_json else {}
            url = meta.get("source_url")
            if url:
                urls.add(url)
        return urls
    finally:
        session.close()


def migrate_example_dataset_ids(db_session_factory: sessionmaker) -> int:
    """Rename existing example DatasetRow.id to the deterministic ``uuid5(source_url)``.

    Historically example dataset rows used random uuid4 primary keys, which
    meant a dataset re-seed (e.g. database wipe + restart) produced new IDs
    and orphaned every chapter that referenced an old ID. This migration
    makes IDs deterministic going forward so future re-seeds reuse the same
    keys.

    Idempotent: rows already at the deterministic ID are left alone. Rows
    whose deterministic ID is already taken (collision with a stranger row)
    are skipped to preserve the conflicting row. ``tile_url`` and
    ``stac_collection_id`` are NOT rewritten — they were baked at original
    registration time and continue to function as opaque tokens against the
    existing pgSTAC collection.

    Returns the number of rows renamed.
    """
    session = db_session_factory()
    try:
        rows = session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).all()
        renamed = 0
        for row in rows:
            meta = json.loads(row.metadata_json) if row.metadata_json else {}
            source_url = meta.get("source_url")
            if not source_url:
                continue
            target_id = example_dataset_id(source_url)
            if row.id == target_id:
                continue
            if session.get(DatasetRow, target_id) is not None:
                logger.warning(
                    "skipping example dataset id migration for %s: "
                    "deterministic id %s is already taken",
                    row.id,
                    target_id,
                )
                continue
            old_id = row.id
            row.id = target_id
            renamed += 1
            logger.info(
                "migrated example dataset id %s -> %s (source_url=%s)",
                old_id,
                target_id,
                source_url,
            )
        if renamed:
            session.commit()
            logger.info("renamed %d example dataset rows to deterministic ids", renamed)
        return renamed
    finally:
        session.close()


def backfill_example_colormaps(db_session_factory: sessionmaker) -> None:
    """Fill in preferred_colormap / preferred_colormap_reversed on example rows.

    Idempotent: only writes when the DB value is currently None. Never
    overwrites a value set manually in the DB. Matches rows to curated
    products by the `source_url` stored in `metadata_json`.
    """
    by_url = {p.listing_url: p for p in list_products()}
    session = db_session_factory()
    try:
        rows = session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).all()
        updated_rows = 0
        for row in rows:
            meta = json.loads(row.metadata_json) if row.metadata_json else {}
            source_url = meta.get("source_url")
            if not source_url:
                continue
            product = by_url.get(source_url)
            if product is None:
                continue
            row_changed = False
            if (
                row.preferred_colormap is None
                and product.preferred_colormap is not None
            ):
                row.preferred_colormap = product.preferred_colormap
                row_changed = True
            if (
                row.preferred_colormap_reversed is None
                and product.preferred_colormap_reversed is not None
            ):
                row.preferred_colormap_reversed = product.preferred_colormap_reversed
                row_changed = True
            if row_changed:
                updated_rows += 1
        if updated_rows:
            session.commit()
            logger.info(
                "backfilled preferred colormap on %d example dataset rows",
                updated_rows,
            )
    finally:
        session.close()


@dataclass(frozen=True)
class ExampleTrajectorySeed:
    source_url: str
    title: str
    filename: str
    bounds: list[float]
    track_count: int
    point_count: int
    time_start: str
    time_end: str
    attribution: str


STORK_TRAJECTORY = ExampleTrajectorySeed(
    source_url=STORK_SOURCE_URL,
    title=STORK_TITLE,
    filename="white-stork-migration.gpx",
    bounds=[-9.230169, 32.21927, 8.151753, 49.049026],
    track_count=1,
    point_count=53475,
    time_start="2020-08-10T09:15:47Z",
    time_end="2021-10-11T19:55:08Z",
    attribution=STORK_ATTRIBUTION,
)


def seed_example_trajectories(db_session_factory: sessionmaker) -> None:
    """Insert pre-built example trajectory datasets.

    Idempotent on the deterministic id derived from ``source_url``. The
    ``trips.json`` + GeoParquet artifacts must already live in R2 at
    ``datasets/<id>/converted/`` (published once, out of band — see
    docs/example-data.md).
    """
    session = db_session_factory()
    try:
        for seed in (STORK_TRAJECTORY,):
            det_id = example_dataset_id(seed.source_url)
            if session.get(DatasetRow, det_id) is not None:
                continue
            trips_url = f"/storage/datasets/{det_id}/converted/trips.json"
            meta = {
                "title": seed.title,
                "source_url": seed.source_url,
                "trips_url": trips_url,
                "track_count": seed.track_count,
                "point_count": seed.point_count,
                "time_start": seed.time_start,
                "time_end": seed.time_end,
                "credits": [{"tool": seed.attribution, "role": "Data from"}],
            }
            session.add(
                DatasetRow(
                    id=det_id,
                    filename=seed.filename,
                    dataset_type="trajectory",
                    format_pair=FormatPair.GPX_TO_GEOPARQUET.value,
                    tile_url=trips_url,
                    bounds_json=json.dumps(seed.bounds),
                    metadata_json=json.dumps(meta),
                    created_at=datetime.now(UTC),
                    workspace_id=None,
                    is_example=True,
                )
            )
            session.commit()
            logger.info("seeded example trajectory dataset: %s", seed.title)
    finally:
        session.close()


async def register_example_datasets(
    db_session_factory: sessionmaker,
    only_slugs: set[str] | None = None,
) -> None:
    """Register each curated source.coop product that is not already present.

    `only_slugs` narrows the set of products considered (used by tests);
    production callers pass None.
    """
    migrate_example_dataset_ids(db_session_factory)
    seed_example_trajectories(db_session_factory)
    backfill_example_colormaps(db_session_factory)
    already = _existing_example_source_urls(db_session_factory)
    for product in ordered_products():
        if only_slugs is not None and product.slug not in only_slugs:
            continue
        if product.listing_url in already:
            logger.info("example dataset already present, skipping: %s", product.slug)
            continue
        logger.info("registering example dataset: %s", product.slug)
        try:
            if product.kind == "pmtiles":
                await register_pmtiles_example(
                    product,
                    db_session_factory,
                    dataset_id=example_dataset_id(product.listing_url),
                )
            else:
                items = await run_enumerator(product)
                job = Job(
                    filename=product.name,
                    dataset_id=example_dataset_id(product.listing_url),
                )
                job.workspace_id = None
                await register_remote_collection(
                    job=job,
                    product=product,
                    items=items,
                    db_session_factory=db_session_factory,
                    is_example=True,
                )
            logger.info("registered example dataset: %s", product.slug)
        except (RemoteRegistrationError, PMTilesRegistrationError):
            logger.exception("registration failed for %s", product.slug)
        except Exception:
            logger.exception("enumeration/registration failed for %s", product.slug)
