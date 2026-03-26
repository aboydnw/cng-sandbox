"""Cascading delete logic for datasets."""

import json
import logging
import re

import httpx
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services import vector_ingest
from src.services.storage import StorageService

logger = logging.getLogger(__name__)


def find_affected_stories(session: Session, dataset_id: str) -> list[str]:
    """Return IDs of stories that reference this dataset."""
    affected = []
    for row in session.query(StoryRow).all():
        if row.dataset_id == dataset_id:
            affected.append(row.id)
            continue
        chapters = json.loads(row.chapters_json) if row.chapters_json else []
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            if lc.get("dataset_id") == dataset_id:
                affected.append(row.id)
                break
    return affected


async def delete_stac_collection(collection_id: str) -> None:
    """Delete STAC items then collection. Best-effort — logs errors."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(
            base_url=settings.stac_api_url, timeout=30.0
        ) as client:
            items_resp = await client.get(f"/collections/{collection_id}/items")
            if items_resp.status_code == 200:
                for feature in items_resp.json().get("features", []):
                    item_id = feature["id"]
                    await client.delete(f"/collections/{collection_id}/items/{item_id}")
            await client.delete(f"/collections/{collection_id}")
    except Exception:
        logger.exception("Failed to delete STAC collection %s", collection_id)


_SAFE_TABLE_RE = re.compile(r"^sandbox_[a-f0-9]+$")


def delete_vector_table(dataset_id: str) -> None:
    """Drop the vector table from PostgreSQL. Best-effort."""
    try:
        from sqlalchemy import create_engine, text

        settings = get_settings()
        table_name = vector_ingest.build_table_name(dataset_id)
        if not _SAFE_TABLE_RE.match(table_name):
            logger.error("Refusing to drop table with unsafe name: %s", table_name)
            return
        engine = create_engine(settings.postgres_dsn)
        with engine.connect() as conn:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))
            conn.commit()
        engine.dispose()
    except Exception:
        logger.exception("Failed to drop vector table for %s", dataset_id)


async def delete_dataset(
    session: Session, dataset_id: str, storage: StorageService | None = None
) -> dict | None:
    """Delete a dataset and all its artifacts. Returns response dict."""
    row = session.get(DatasetRow, dataset_id)
    if row is None:
        return None

    meta = json.loads(row.metadata_json) if row.metadata_json else {}
    affected = find_affected_stories(session, dataset_id)

    stac_collection_id = meta.get("stac_collection_id")
    if stac_collection_id:
        await delete_stac_collection(stac_collection_id)

    pg_table = meta.get("pg_table")
    if pg_table:
        delete_vector_table(dataset_id)

    if storage is not None:
        try:
            storage.delete_prefix(f"datasets/{dataset_id}/")
        except Exception:
            logger.exception("Failed to delete S3 objects for %s", dataset_id)

    session.delete(row)
    session.commit()

    return {"deleted": True, "affected_stories": affected}
