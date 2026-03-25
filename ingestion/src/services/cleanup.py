"""Periodic cleanup of expired datasets and stories."""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.story import StoryRow

logger = logging.getLogger(__name__)


def cleanup_expired_rows(
    session: Session,
    ttl_days: int = 30,
    check_storage: bool = True,
    storage_service=None,
) -> list[str]:
    """Delete datasets and stories older than ttl_days. Returns list of deleted IDs."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    deleted = []

    expired_datasets = (
        session.query(DatasetRow)
        .filter(DatasetRow.created_at < cutoff)
        .all()
    )
    for row in expired_datasets:
        logger.info("Cleaning up expired dataset %s (%s)", row.id, row.filename)
        session.delete(row)
        deleted.append(row.id)

    expired_stories = (
        session.query(StoryRow)
        .filter(StoryRow.created_at < cutoff)
        .all()
    )
    for row in expired_stories:
        logger.info("Cleaning up expired story %s (%s)", row.id, row.title)
        session.delete(row)
        deleted.append(row.id)

    if deleted:
        session.commit()
        logger.info("Cleaned up %d expired rows", len(deleted))

    return deleted
