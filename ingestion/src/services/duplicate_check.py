"""Check for duplicate dataset filenames within a workspace."""

from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow


def check_duplicate_filename(
    session: Session, filename: str, workspace_id: str
) -> str | None:
    """Return the dataset ID if a duplicate filename exists, else None."""
    row = (
        session.query(DatasetRow.id)
        .filter(
            DatasetRow.filename == filename,
            DatasetRow.workspace_id == workspace_id,
        )
        .first()
    )
    return row.id if row else None
