"""Periodic cleanup of expired datasets and stories."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.expiry import RETENTION_DAYS
from src.models.story import StoryRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService

logger = logging.getLogger(__name__)


async def cleanup_expired_rows(
    session: Session,
    ttl_days: int = RETENTION_DAYS,
    storage: StorageService | None = None,
) -> list[str]:
    """Delete expired datasets (with full cascading cleanup) and stories.

    Returns list of deleted IDs.
    """
    from sqlalchemy import or_

    now = datetime.now(UTC)
    cutoff = now - timedelta(days=ttl_days)
    deleted = []

    expired_datasets = (
        session.query(DatasetRow)
        .filter(
            DatasetRow.is_example.is_(False),
            DatasetRow.is_example_copy.is_(False),
            or_(
                (DatasetRow.expires_at.isnot(None)) & (DatasetRow.expires_at < now),
                (DatasetRow.expires_at.is_(None)) & (DatasetRow.created_at < cutoff),
            ),
        )
        .all()
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

    expired_stories = (
        session.query(StoryRow)
        .filter(
            StoryRow.is_example.is_(False),
            StoryRow.is_example_copy.is_(False),
            StoryRow.created_at < cutoff,
        )
        .all()
    )
    for row in expired_stories:
        logger.info("Cleaning up expired story %s (%s)", row.id, row.title)
        session.delete(row)
        deleted.append(row.id)

    if expired_stories:
        session.commit()

    if deleted:
        logger.info("Cleaned up %d expired rows", len(deleted))

    return deleted
