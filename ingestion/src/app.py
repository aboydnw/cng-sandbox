"""FastAPI application for the CNG Sandbox ingestion service."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker

from src.config import get_settings
from src.models.base import Base
from src.models.dataset import DatasetRow  # noqa: F401 — ensures table creation
from src.services.cleanup import cleanup_expired_rows
from src.state import scan_store, scan_store_lock

logger = logging.getLogger(__name__)


async def _cleanup_scans():
    """Remove expired scan entries every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.now(UTC) - timedelta(minutes=30)
        async with scan_store_lock:
            expired = [
                sid
                for sid, entry in scan_store.items()
                if entry.get("state") == "waiting"
                and entry.get("created_at", datetime.now(UTC)) < cutoff
            ]
            for sid in expired:
                del scan_store[sid]


async def _cleanup_expired(app):
    while True:
        await asyncio.sleep(6 * 3600)
        try:
            session = app.state.db_session_factory()
            try:
                cleanup_expired_rows(session)
            finally:
                session.close()
        except Exception:
            logger.exception("Cleanup task failed")


@asynccontextmanager
async def _default_lifespan(app: FastAPI):
    Base.metadata.create_all(app.state.db_engine)
    cleanup_task = asyncio.create_task(_cleanup_scans())
    expired_task = asyncio.create_task(_cleanup_expired(app))
    yield
    cleanup_task.cancel()
    expired_task.cancel()


def create_app(settings=None, lifespan=None) -> FastAPI:
    """Application factory — testable configuration."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    if settings is None:
        settings = get_settings()
    if lifespan is None:
        lifespan = _default_lifespan

    app = FastAPI(title="CNG Sandbox Ingestion API", lifespan=lifespan)

    db_engine = sa_create_engine(settings.postgres_dsn)
    app.state.db_engine = db_engine
    app.state.db_session_factory = sessionmaker(bind=db_engine)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    from src.routes.bug_report import router as bug_report_router
    from src.routes.datasets import router as datasets_router
    from src.routes.jobs import router as jobs_router
    from src.routes.stories import router as stories_router
    from src.routes.upload import router as upload_router

    app.include_router(upload_router)
    app.include_router(jobs_router)
    app.include_router(datasets_router)
    app.include_router(stories_router)
    app.include_router(bug_report_router)

    return app


app = create_app()
