"""FastAPI application for the CNG Sandbox ingestion service."""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

import boto3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker
from src.config import get_settings
from src.models.base import Base
from src.state import scan_store, scan_store_lock


async def _cleanup_scans():
    """Remove expired scan entries every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        async with scan_store_lock:
            expired = [
                sid for sid, entry in scan_store.items()
                if entry.get("state") == "waiting"
                and entry.get("created_at", datetime.now(timezone.utc)) < cutoff
            ]
            for sid in expired:
                del scan_store[sid]


@asynccontextmanager
async def _default_lifespan(app: FastAPI):
    settings = get_settings()
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.s3_region,
    )
    for attempt in range(30):
        try:
            s3.head_bucket(Bucket=settings.s3_bucket)
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(2)
    app.state.s3 = s3
    cleanup_task = asyncio.create_task(_cleanup_scans())
    yield
    cleanup_task.cancel()


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
    Base.metadata.create_all(db_engine)
    app.state.db_session_factory = sessionmaker(bind=db_engine)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    from src.routes.upload import router as upload_router
    from src.routes.jobs import router as jobs_router
    from src.routes.datasets import router as datasets_router
    from src.routes.stories import router as stories_router
    app.include_router(upload_router)
    app.include_router(jobs_router)
    app.include_router(datasets_router)
    app.include_router(stories_router)

    return app


app = create_app()
