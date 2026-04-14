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

from sqlalchemy.orm import sessionmaker

from src.models import Job
from src.models.dataset import DatasetRow
from src.services.enumerators import RemoteItem
from src.services.enumerators.path_listing import enumerate_path_listing
from src.services.enumerators.stac_sidecars import enumerate_stac_sidecars
from src.services.remote_register import (
    RemoteRegistrationError,
    register_remote_collection,
)
from src.services.source_coop_config import SourceCoopProduct, list_products

logger = logging.getLogger(__name__)


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


async def register_example_datasets(
    db_session_factory: sessionmaker,
    only_slugs: set[str] | None = None,
) -> None:
    """Register each curated source.coop product that is not already present.

    `only_slugs` narrows the set of products considered (used by tests);
    production callers pass None.
    """
    already = _existing_example_source_urls(db_session_factory)
    for product in ordered_products():
        if only_slugs is not None and product.slug not in only_slugs:
            continue
        if product.listing_url in already:
            logger.info("example dataset already present, skipping: %s", product.slug)
            continue
        logger.info("registering example dataset: %s", product.slug)
        try:
            items = await run_enumerator(product)
            job = Job(filename=product.name)
            job.workspace_id = None
            await register_remote_collection(
                job=job,
                product=product,
                items=items,
                db_session_factory=db_session_factory,
                is_example=True,
            )
            logger.info("registered example dataset: %s", product.slug)
        except RemoteRegistrationError:
            logger.exception("registration failed for %s", product.slug)
        except Exception:
            logger.exception("enumeration/registration failed for %s", product.slug)
