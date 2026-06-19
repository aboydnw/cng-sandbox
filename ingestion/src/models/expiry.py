"""Shared retention/expiry computation for datasets and stories."""

from datetime import datetime, timedelta

RETENTION_DAYS = 30


def effective_expires_at(
    created_at: datetime | None,
    expires_at: datetime | None = None,
    is_example: bool = False,
) -> datetime | None:
    """Return when a row will be cleaned up, or None if it never expires.

    Example rows never expire. Rows with an explicit ``expires_at`` use it;
    otherwise expiry falls back to ``created_at`` plus the retention window,
    mirroring the cleanup task's deletion criteria.
    """
    if is_example:
        return None
    if expires_at is not None:
        return expires_at
    if created_at is None:
        return None
    return created_at + timedelta(days=RETENTION_DAYS)
