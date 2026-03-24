"""Proxy endpoints for browsing external STAC catalogs."""

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.middleware.rate_limit import catalog_rate_limiter
from src.services.catalog_providers import PROVIDERS

router = APIRouter(prefix="/api/catalog")

PROXY_TIMEOUT = 10.0


@router.get("/providers")
async def list_providers():
    return [
        {"id": p.id, "name": p.name, "description": p.description}
        for p in PROVIDERS.values()
    ]


def _get_provider(provider_id: str):
    provider = PROVIDERS.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider_id}")
    return provider


@router.get("/{provider_id}/collections")
async def list_collections(provider_id: str):
    provider = _get_provider(provider_id)
    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        resp = await client.get(f"{provider.stac_api_url}/collections")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="External STAC API error")
    return resp.json()


@router.get("/{provider_id}/collections/{collection_id}")
async def get_collection(provider_id: str, collection_id: str):
    provider = _get_provider(provider_id)
    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        resp = await client.get(
            f"{provider.stac_api_url}/collections/{collection_id}"
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Collection not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="External STAC API error")
    return resp.json()


class SearchRequest(BaseModel):
    collections: list[str]
    bbox: list[float] | None = None
    datetime: str | None = None
    filter: dict | None = None
    filter_lang: str | None = "cql2-json"
    limit: int = 20


@router.post("/{provider_id}/search")
async def search_items(provider_id: str, body: SearchRequest, request: Request):
    catalog_rate_limiter.check(request)
    provider = _get_provider(provider_id)
    payload = {
        "collections": body.collections,
        "limit": min(body.limit, 100),
        "sortby": [{"field": "datetime", "direction": "desc"}],
    }
    if body.bbox:
        payload["bbox"] = body.bbox
    if body.datetime:
        payload["datetime"] = body.datetime
    if body.filter:
        payload["filter"] = body.filter
        payload["filter-lang"] = body.filter_lang or "cql2-json"

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        resp = await client.post(
            f"{provider.stac_api_url}/search",
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="External STAC API error")
    return resp.json()
