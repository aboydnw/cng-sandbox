"""Route for connecting a curated source.coop product as a zero-copy dataset."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.models import Job
from src.services.enumerators import RemoteItem
from src.services.enumerators.path_listing import enumerate_path_listing
from src.services.enumerators.stac_sidecars import enumerate_stac_sidecars
from src.services.remote_register import (
    RemoteRegistrationError,
    register_remote_collection,
)
from src.services.source_coop_config import SourceCoopProduct, get_product
from src.state import jobs
from src.workspace import get_workspace_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


class ConnectSourceCoopRequest(BaseModel):
    product_slug: str


class ConnectSourceCoopResponse(BaseModel):
    dataset_id: str
    job_id: str


async def run_enumerator(product: SourceCoopProduct) -> list[RemoteItem]:
    """Dispatch to the enumerator named in the product config."""
    if product.enumerator == "path_listing":
        return await enumerate_path_listing(listing_url=product.listing_url)
    if product.enumerator == "stac_sidecars":
        return await enumerate_stac_sidecars(
            listing_url=product.listing_url,
            recursive=product.enumerator_args.get("recursive", False),
        )
    raise ValueError(f"Unknown enumerator: {product.enumerator}")


@router.post("/connect-source-coop", response_model=ConnectSourceCoopResponse)
async def connect_source_coop(
    request: Request,
    body: ConnectSourceCoopRequest,
    workspace_id: str = Depends(get_workspace_id),
):
    try:
        product = get_product(body.product_slug)
    except KeyError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Product {body.product_slug!r} not found in curated registry",
        ) from e

    job = Job(filename=product.name)
    job.workspace_id = workspace_id
    jobs[job.id] = job

    try:
        items = await run_enumerator(product)
    except Exception as e:
        logger.exception("Enumeration failed for %s", product.slug)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to enumerate source.coop product: {e}",
        ) from e

    try:
        dataset_id = await register_remote_collection(
            job=job,
            product=product,
            items=items,
            db_session_factory=request.app.state.db_session_factory,
        )
    except RemoteRegistrationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    return ConnectSourceCoopResponse(dataset_id=dataset_id, job_id=job.id)
