"""FastAPI application for the CNG Sandbox ingestion service."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker

from src.config import get_settings
from src.models.base import Base
from src.models.connection import ConnectionRow  # noqa: F401 — ensures table creation
from src.models.dataset import DatasetRow  # noqa: F401 — ensures table creation
from src.rate_limit import limiter, rate_limit_exceeded_handler
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


async def _register_examples(app):
    """Register example datasets with bounded retry for transient startup failures.

    If upstream dependencies (database, STAC API, remote tiles) are not ready
    when the ingestion container boots, registering any product may raise.
    Retry a few times with backoff so a slow-starting deploy still populates
    the gallery without requiring a manual restart.
    """
    from src.services.example_datasets import (
        missing_example_products,
        register_example_datasets,
    )

    backoffs = [0, 30, 60, 120, 240]
    for attempt, delay in enumerate(backoffs, start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            await register_example_datasets(
                db_session_factory=app.state.db_session_factory
            )
            missing = missing_example_products(app.state.db_session_factory)
            if not missing:
                return
            logger.warning(
                "Example dataset registration incomplete after attempt %d "
                "(still missing: %s)",
                attempt,
                [p.slug for p in missing],
            )
        except Exception:
            logger.exception("Example dataset registration attempt %d failed", attempt)
    logger.error(
        "Gave up registering example datasets after %d attempts", len(backoffs)
    )


async def _seed_stories(app: FastAPI) -> None:
    """Seed example stories independently from dataset registration.

    Poll on a fixed cadence so that stories whose datasets are ready can
    seed without waiting for slower products (e.g. GHRSST temporal
    enumeration). `seed_example_stories` is idempotent, so repeated
    polling is safe.
    """
    from src.models.story import StoryRow
    from src.services.example_stories import ALL_STORIES, seed_example_stories

    canonical_titles = {s.title for s in ALL_STORIES}
    attempts = 0
    while True:
        attempts += 1
        try:
            seed_example_stories(app.state.db_session_factory)
            session = app.state.db_session_factory()
            try:
                seeded = {
                    row.title
                    for row in session.query(StoryRow)
                    .filter(StoryRow.is_example.is_(True))
                    .all()
                }
            finally:
                session.close()
            if canonical_titles.issubset(seeded):
                return
        except Exception:
            logger.exception("Example story seeding attempt failed")
        await asyncio.sleep(30)
        if attempts % 60 == 0:
            logger.warning(
                "Example story seeding still incomplete after %d attempts", attempts
            )


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

    def _is_duplicate_column(exc: DBAPIError) -> bool:
        # PostgreSQL raises SQLSTATE 42701 (duplicate_column); SQLite and
        # other dialects don't set pgcode, so fall back to matching the
        # canonical "duplicate column" phrase in the driver message.
        orig = getattr(exc, "orig", None)
        if getattr(orig, "pgcode", None) == "42701":
            return True
        return "duplicate column" in str(orig).lower()

    with engine.connect() as conn:
        for col, typ in [
            ("band_count", "INTEGER"),
            ("rescale", "TEXT"),
            ("is_categorical", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("categories_json", "TEXT"),
            ("tile_url", "TEXT"),
            ("render_path", "TEXT"),
            ("conversion_status", "TEXT"),
            ("conversion_error", "TEXT"),
            ("feature_count", "INTEGER"),
            ("file_size", "BIGINT"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE connections ADD COLUMN {col} {typ}"))
                conn.commit()
            except DBAPIError as exc:
                conn.rollback()
                if _is_duplicate_column(exc):
                    continue
                raise
        try:
            conn.execute(text("ALTER TABLE datasets ADD COLUMN expires_at TIMESTAMP"))
            conn.commit()
        except DBAPIError as exc:
            conn.rollback()
            if not _is_duplicate_column(exc):
                raise
        try:
            conn.execute(
                text(
                    "ALTER TABLE datasets ADD COLUMN is_example BOOLEAN "
                    "NOT NULL DEFAULT FALSE"
                )
            )
            conn.commit()
        except DBAPIError as exc:
            conn.rollback()
            if not _is_duplicate_column(exc):
                raise
        try:
            conn.execute(
                text(
                    "ALTER TABLE stories ADD COLUMN is_example BOOLEAN "
                    "NOT NULL DEFAULT FALSE"
                )
            )
            conn.commit()
        except DBAPIError as exc:
            conn.rollback()
            if not _is_duplicate_column(exc):
                raise
        for table in ("datasets", "connections"):
            try:
                conn.execute(
                    text(
                        f"ALTER TABLE {table} ADD COLUMN is_shared BOOLEAN "
                        "NOT NULL DEFAULT FALSE"
                    )
                )
                conn.commit()
            except DBAPIError as exc:
                conn.rollback()
                if not _is_duplicate_column(exc):
                    raise
        for table in ("datasets", "connections"):
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN render_mode TEXT"))
                conn.commit()
            except DBAPIError as exc:
                conn.rollback()
                if not _is_duplicate_column(exc):
                    raise
        # Remove duplicate is_example rows before creating the unique index so
        # that deployments upgrading from a version without the index don't
        # fail. Keep the row with the lowest id for each duplicate title.
        try:
            conn.execute(
                text(
                    "DELETE FROM stories WHERE is_example AND id NOT IN ("
                    "  SELECT MIN(id) FROM stories WHERE is_example GROUP BY title"
                    ")"
                )
            )
            conn.commit()
        except DBAPIError:
            conn.rollback()
            raise
        # Partial unique index so concurrent startups cannot insert
        # duplicate is_example=True story titles. PostgreSQL and SQLite
        # both support `CREATE UNIQUE INDEX ... WHERE ...`.
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_stories_example_title "
                    "ON stories (title) WHERE is_example"
                )
            )
            conn.commit()
        except DBAPIError:
            conn.rollback()
            raise


@asynccontextmanager
async def _default_lifespan(app: FastAPI):
    Base.metadata.create_all(app.state.db_engine)
    _migrate_schema(app.state.db_engine)
    cleanup_task = asyncio.create_task(_cleanup_scans())
    expired_task = asyncio.create_task(_cleanup_expired(app))
    examples_task = asyncio.create_task(_register_examples(app))
    stories_task = asyncio.create_task(_seed_stories(app))
    yield
    cleanup_task.cancel()
    expired_task.cancel()
    examples_task.cancel()
    stories_task.cancel()


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

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

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
    from src.routes.connect_source_coop import router as connect_source_coop_router
    from src.routes.connections import router as connections_router
    from src.routes.datasets import router as datasets_router
    from src.routes.inspect import router as inspect_router
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
    app.include_router(connect_source_coop_router)
    app.include_router(inspect_router)

    return app


app = create_app()
