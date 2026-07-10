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
    """Upsert the workspace's example-seeding state and commit."""
    row = session.get(WorkspaceExampleStateRow, workspace_id)
    if row is None:
        row = WorkspaceExampleStateRow(workspace_id=workspace_id, state=state)
        session.add(row)
    else:
        row.state = state
    session.commit()
