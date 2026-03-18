"""FastAPI application for the CNG Sandbox ingestion service."""

import time
from contextlib import asynccontextmanager

import boto3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    yield


def create_app(settings=None) -> FastAPI:
    """Application factory — testable configuration."""
    if settings is None:
        settings = get_settings()

    app = FastAPI(title="CNG Sandbox Ingestion API", lifespan=lifespan)

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
    app.include_router(upload_router)
    app.include_router(jobs_router)
    app.include_router(datasets_router)

    return app


app = create_app()
