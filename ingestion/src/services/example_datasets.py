"""Startup task: register source.coop curated products as example datasets."""

from __future__ import annotations

from src.services.enumerators import RemoteItem
from src.services.enumerators.path_listing import enumerate_path_listing
from src.services.enumerators.stac_sidecars import enumerate_stac_sidecars
from src.services.source_coop_config import SourceCoopProduct


async def run_enumerator(product: SourceCoopProduct) -> list[RemoteItem]:
    """Dispatch to the enumerator named in the product config."""
    if product.enumerator == "path_listing":
        return await enumerate_path_listing(listing_url=product.listing_url)
    if product.enumerator == "stac_sidecars":
        return await enumerate_stac_sidecars(
            listing_url=product.listing_url,
            recursive=product.enumerator_args.get("recursive", False),
            start_prefix=product.enumerator_args.get("start_prefix", ""),
        )
    raise ValueError(f"Unknown enumerator: {product.enumerator}")
