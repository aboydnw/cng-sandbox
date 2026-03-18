"""Load GeoParquet into PostgreSQL for tipg vector tile serving."""

import geopandas as gpd
from sqlalchemy import create_engine

from src.config import get_settings


def build_table_name(dataset_id: str) -> str:
    """Build a PostgreSQL table name from a dataset ID."""
    sanitized = dataset_id.replace("-", "")
    return f"sandbox_{sanitized}"


def get_vector_tile_url(dataset_id: str, tiler_url: str | None = None) -> str:
    """Build the tipg vector tile URL template for a dataset."""
    if tiler_url is None:
        tiler_url = get_settings().public_vector_tiler_url
    table = build_table_name(dataset_id)
    return f"{tiler_url}/collections/public.{table}/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}"


def ingest_vector(dataset_id: str, parquet_path: str) -> str:
    """Load GeoParquet into PostgreSQL. Returns tile URL template.

    tipg auto-discovers new tables in the public schema and
    serves them as OGC Features + vector tiles.

    This is a sync function — call via asyncio.to_thread() from async code.
    """
    settings = get_settings()
    table_name = build_table_name(dataset_id)

    gdf = gpd.read_parquet(parquet_path)
    gdf.columns = [c.lower() for c in gdf.columns]

    engine = create_engine(settings.postgres_dsn)
    gdf.to_postgis(table_name, engine, if_exists="replace", index=False)
    engine.dispose()

    return get_vector_tile_url(dataset_id)
