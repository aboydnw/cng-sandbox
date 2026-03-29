"""Shared FastAPI dependencies."""

from fastapi import Request
from sqlalchemy.orm import Session


def get_session(request: Request) -> Session:
    """Get a SQLAlchemy session from the app state."""
    return request.app.state.db_session_factory()
