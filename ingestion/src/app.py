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
from src.models.connection import ConnectionRow  # noqa: F401 — ensures table creation
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
            from src.services.storage import StorageService

            session = app.state.db_session_factory()
            try:
                try:
                    storage = StorageService()
                except Exception:
                    logger.exception(
                        "Storage init failed; continuing without object-store cleanup"
                    )
                    storage = None
                await cleanup_expired_rows(session, storage=storage)
            finally:
                session.close()
        except Exception:
            logger.exception("Cleanup task failed")


def _migrate_schema(engine):
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    with engine.connect() as conn:
        for col, typ in [("band_count", "INTEGER"), ("rescale", "TEXT"), ("expires_at", "TIMESTAMP")]:
            try:
                conn.execute(text(f"ALTER TABLE connections ADD COLUMN {col} {typ}"))
                conn.commit()
            except DBAPIError as exc:
                conn.rollback()
                if getattr(getattr(exc, "orig", None), "pgcode", None) == "42701":
                    continue
                raise


@asynccontextmanager
async def _default_lifespan(app: FastAPI):
    Base.metadata.create_all(app.state.db_engine)
    _migrate_schema(app.state.db_engine)
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
    from src.routes.connect_remote import router as connect_remote_router
    from src.routes.connections import router as connections_router
    from src.routes.datasets import router as datasets_router
    from src.routes.jobs import router as jobs_router
    from src.routes.proxy import router as proxy_router
    from src.routes.stories import router as stories_router
    from src.routes.upload import router as upload_router

    app.include_router(upload_router)
    app.include_router(jobs_router)
    app.include_router(datasets_router)
    app.include_router(stories_router)
    app.include_router(bug_report_router)
    app.include_router(connections_router)
    app.include_router(proxy_router)
    app.include_router(connect_remote_router)

    return app


app = create_app()
