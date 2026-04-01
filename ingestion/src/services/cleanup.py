"""Periodic cleanup of expired datasets and stories."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService

logger = logging.getLogger(__name__)


async def cleanup_expired_rows(
    session: Session,
    ttl_days: int = 30,
    storage: StorageService | None = None,
) -> list[str]:
    """Delete expired datasets (with full cascading cleanup) and stories.

    Returns list of deleted IDs.
    """
    cutoff = datetime.now(UTC) - timedelta(days=ttl_days)
    deleted = []

    expired_datasets = (
        session.query(DatasetRow).filter(DatasetRow.created_at < cutoff).all()
    )
    for row in expired_datasets:
        logger.info("Cleaning up expired dataset %s (%s)", row.id, row.filename)
        try:
            await delete_dataset(session, row.id, storage=storage)
        except Exception:
            session.rollback()
            logger.exception("Failed cascading delete for dataset %s", row.id)
            continue
        deleted.append(row.id)

    expired_stories = session.query(StoryRow).filter(StoryRow.created_at < cutoff).all()
    for row in expired_stories:
        logger.info("Cleaning up expired story %s (%s)", row.id, row.title)
        session.delete(row)
        deleted.append(row.id)

    if expired_stories:
        session.commit()

    if deleted:
        logger.info("Cleaned up %d expired rows", len(deleted))

    return deleted
