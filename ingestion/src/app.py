"""FastAPI application for the CNG Sandbox ingestion service."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import posthog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker

from src.config import get_settings
from src.models import JobStatus
from src.models.base import Base
from src.models.connection import ConnectionRow  # noqa: F401 — ensures table creation
from src.models.dataset import DatasetRow  # noqa: F401 — ensures table creation
from src.models.story_asset import StoryAssetRow  # noqa: F401 — ensures table creation
from src.models.workspace_example_state import (  # noqa: F401 — ensures table creation
    WorkspaceExampleStateRow,
)
from src.rate_limit import limiter, rate_limit_exceeded_handler
from src.services.cleanup import cleanup_expired_rows
from src.state import jobs, scan_store, scan_store_lock

logger = logging.getLogger(__name__)

SCAN_TTL = timedelta(minutes=30)
TERMINAL_JOB_TTL = timedelta(hours=1)


async def _expire_stale_scans(now: datetime | None = None):
    """Fail and release pipelines whose variable-selection scan was abandoned.

    Pipelines paused for variable selection block on ``job.scan_event``.
    Without this, an abandoned scan leaves the pipeline coroutine waiting
    forever and its temp upload on disk permanently.
    """
    now = now or datetime.now(UTC)
    cutoff = now - SCAN_TTL
    async with scan_store_lock:
        expired = [
            sid
            for sid, entry in scan_store.items()
            if entry.get("state") == "waiting" and entry.get("created_at", now) < cutoff
        ]
        for sid in expired:
            entry = scan_store.pop(sid)
            job = entry.get("job")
            if job is not None:
                job.status = JobStatus.FAILED
                job.error = (
                    "Scan expired — no variable was selected within 30 minutes. "
                    "Please re-upload the file."
                )
                if job.scan_event is not None:
                    job.scan_event.set()
                logger.info("Expired abandoned scan %s (job %s)", sid, job.id)


def _evict_terminal_jobs(now: datetime | None = None):
    """Drop jobs that have been in a terminal status for over an hour.

    The terminal transition is stamped on first observation by this sweep,
    so eviction happens one TTL after the sweep first sees the job done.
    """
    now = now or datetime.now(UTC)
    cutoff = now - TERMINAL_JOB_TTL
    for job_id, job in list(jobs.items()):
        if job.status not in (JobStatus.READY, JobStatus.FAILED):
            continue
        if job.finished_at is None:
            job.finished_at = now
        elif job.finished_at < cutoff:
            del jobs[job_id]


async def _cleanup_scans():
    """Expire abandoned scans and evict finished jobs every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        await _expire_stale_scans()
        _evict_terminal_jobs()


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
    from src.services.example_stories import (
        ALL_STORIES,
        relink_dead_chapter_dataset_ids,
        seed_example_stories,
    )

    canonical_titles = {s.title for s in ALL_STORIES}
    attempts = 0
    max_attempts = 2880  # ~24h at one attempt per 30s
    while attempts < max_attempts:
        attempts += 1
        try:
            seed_example_stories(app.state.db_session_factory)
            relink_dead_chapter_dataset_ids(app.state.db_session_factory)
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
    logger.error(
        "Giving up on example story seeding after %d attempts; "
        "some canonical stories never seeded",
        max_attempts,
    )


async def _seed_example_connections(app: FastAPI) -> None:
    """Seed curated example connections on startup. Idempotent + best-effort."""
    import asyncio

    from src.services.example_connections import seed_example_connections

    try:
        await asyncio.to_thread(seed_example_connections, app.state.db_session_factory)
    except Exception:
        logger.exception("Example connection seeding failed")


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
    """Apply additive schema migrations that create_all won't perform.

    This is the single live migration mechanism for the ingestion service:
    it runs on every startup right after ``Base.metadata.create_all`` and
    every statement must stay idempotent. The eventual destination for this
    is alembic.
    """
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    columns = [
        ("connections", "band_count", "INTEGER"),
        ("connections", "rescale", "TEXT"),
        ("connections", "is_categorical", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("connections", "categories_json", "TEXT"),
        ("connections", "tile_url", "TEXT"),
        ("connections", "render_path", "TEXT"),
        ("connections", "conversion_status", "TEXT"),
        ("connections", "conversion_error", "TEXT"),
        ("connections", "feature_count", "INTEGER"),
        ("connections", "file_size", "BIGINT"),
        ("datasets", "expires_at", "TIMESTAMP"),
        ("datasets", "is_example", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("stories", "is_example", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("datasets", "is_shared", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("connections", "is_shared", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("datasets", "render_mode", "TEXT"),
        ("connections", "render_mode", "TEXT"),
        ("datasets", "preferred_colormap", "TEXT"),
        ("connections", "preferred_colormap", "TEXT"),
        ("datasets", "preferred_colormap_reversed", "BOOLEAN"),
        ("connections", "preferred_colormap_reversed", "BOOLEAN"),
        ("connections", "config", "JSONB"),
        ("connections", "geozarr_attrs", "JSONB"),
        ("connections", "is_example", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("stories", "workspace_id", "TEXT"),
        ("datasets", "workspace_id", "TEXT"),
        ("stories", "forked_from_id", "TEXT"),
        ("datasets", "is_example_copy", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("datasets", "seeded_from_id", "TEXT"),
        ("connections", "is_example_copy", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("connections", "seeded_from_id", "TEXT"),
        ("stories", "is_example_copy", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("stories", "seeded_from_id", "TEXT"),
    ]

    # SQLite cannot express ALTER COLUMN ... DROP NOT NULL; it is also
    # unnecessary there because only pre-existing PostgreSQL deployments
    # carry the old NOT NULL constraint on stories.dataset_id.
    postgres_statements = [
        "ALTER TABLE stories ALTER COLUMN dataset_id DROP NOT NULL",
    ]

    statements = [
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_stories_fork_lookup "
        "ON stories (workspace_id, forked_from_id) "
        "WHERE forked_from_id IS NOT NULL",
        # Remove duplicate is_example rows before creating the unique index so
        # that deployments upgrading from a version without the index don't
        # fail. Keep the row with the lowest id for each duplicate title.
        "DELETE FROM stories WHERE is_example AND id NOT IN ("
        "  SELECT MIN(id) FROM stories WHERE is_example GROUP BY title"
        ")",
        # Partial unique index so concurrent startups cannot insert
        # duplicate is_example=True story titles. PostgreSQL and SQLite
        # both support `CREATE UNIQUE INDEX ... WHERE ...`.
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_stories_example_title "
        "ON stories (title) WHERE is_example",
    ]

    def _is_duplicate_column(exc: DBAPIError) -> bool:
        # PostgreSQL raises SQLSTATE 42701 (duplicate_column); SQLite and
        # other dialects don't set pgcode, so fall back to matching the
        # canonical "duplicate column" phrase in the driver message.
        orig = getattr(exc, "orig", None)
        if getattr(orig, "pgcode", None) == "42701":
            return True
        return "duplicate column" in str(orig).lower()

    def _add_column(conn, table: str, column: str, ddl: str) -> None:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            conn.commit()
        except DBAPIError as exc:
            conn.rollback()
            if not _is_duplicate_column(exc):
                raise

    def _execute(conn, statement: str) -> None:
        try:
            conn.execute(text(statement))
            conn.commit()
        except DBAPIError:
            conn.rollback()
            raise

    with engine.connect() as conn:
        for table, column, ddl in columns:
            _add_column(conn, table, column, ddl)
        if engine.dialect.name == "postgresql":
            for statement in postgres_statements:
                _execute(conn, statement)
        for statement in statements:
            _execute(conn, statement)


@asynccontextmanager
async def _default_lifespan(app: FastAPI):
    settings = get_settings()
    if not settings.posthog_disabled and settings.posthog_project_token:
        posthog.api_key = settings.posthog_project_token
        posthog.host = settings.posthog_host
        posthog.debug = False

    Base.metadata.create_all(app.state.db_engine)
    _migrate_schema(app.state.db_engine)
    cleanup_task = asyncio.create_task(_cleanup_scans())
    expired_task = asyncio.create_task(_cleanup_expired(app))
    examples_task = asyncio.create_task(_register_examples(app))
    stories_task = asyncio.create_task(_seed_stories(app))
    connections_task = asyncio.create_task(_seed_example_connections(app))
    yield
    cleanup_task.cancel()
    expired_task.cancel()
    examples_task.cancel()
    stories_task.cancel()
    connections_task.cancel()

    if not settings.posthog_disabled and settings.posthog_project_token:
        posthog.flush()


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
    from src.routes.chat import router as chat_router
    from src.routes.connect_remote import router as connect_remote_router
    from src.routes.connect_source_coop import router as connect_source_coop_router
    from src.routes.connections import router as connections_router
    from src.routes.dataset_charts import router as dataset_charts_router
    from src.routes.datasets import router as datasets_router
    from src.routes.inspect import router as inspect_router
    from src.routes.jobs import router as jobs_router
    from src.routes.proxy import router as proxy_router
    from src.routes.stories import router as stories_router
    from src.routes.story_assets import router as story_assets_router
    from src.routes.upload import router as upload_router
    from src.routes.validation import router as validation_router
    from src.routes.workspace_examples import router as workspace_examples_router
    from src.routes.zarr_proxy import router as zarr_proxy_router

    app.include_router(upload_router)
    app.include_router(jobs_router)
    app.include_router(datasets_router)
    app.include_router(dataset_charts_router)
    app.include_router(stories_router)
    app.include_router(story_assets_router)
    app.include_router(bug_report_router)
    app.include_router(connections_router)
    app.include_router(proxy_router)
    app.include_router(connect_remote_router)
    app.include_router(connect_source_coop_router)
    app.include_router(inspect_router)
    app.include_router(zarr_proxy_router)
    app.include_router(validation_router)
    app.include_router(chat_router)
    app.include_router(workspace_examples_router)

    return app


app = create_app()
