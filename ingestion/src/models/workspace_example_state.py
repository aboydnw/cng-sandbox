"""Per-workspace example-seeding state."""

from sqlalchemy import Column, String
from sqlalchemy.orm import Session

from src.models.base import Base


class WorkspaceExampleStateRow(Base):
    __tablename__ = "workspace_example_state"

    workspace_id = Column(String, primary_key=True)
    state = Column(String, nullable=False)


def get_state(session: Session, workspace_id: str) -> str:
    """Return ``"seeded"``, ``"removed"``, or ``"none"`` if unset."""
    row = session.get(WorkspaceExampleStateRow, workspace_id)
    return row.state if row else "none"


def set_state(session: Session, workspace_id: str, state: str) -> None:
    """Upsert the workspace's example-seeding state and commit.

    Commits any pending work on the session in the same transaction, so callers
    can stage row changes and let this persist them atomically with the state.
    Uses an INSERT ... ON CONFLICT DO UPDATE so concurrent callers for the same
    workspace can't collide on the primary key.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    dialect = session.bind.dialect.name if session.bind is not None else ""
    insert = pg_insert if dialect == "postgresql" else sqlite_insert
    stmt = insert(WorkspaceExampleStateRow).values(
        workspace_id=workspace_id, state=state
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[WorkspaceExampleStateRow.workspace_id],
        set_={"state": state},
    )
    session.execute(stmt)
    session.commit()
