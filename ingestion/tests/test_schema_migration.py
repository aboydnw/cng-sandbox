from sqlalchemy import create_engine, inspect, text

from src.app import _migrate_schema


def _create_pre_ticket_b_schema(engine) -> None:
    """Recreate the ``connections`` / ``datasets`` schema as it existed before
    the server-side GeoParquet conversion columns (Ticket B) were added. This
    mimics the drifted state of the deployed database."""
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    connection_type TEXT NOT NULL,
                    bounds_json TEXT,
                    min_zoom INTEGER,
                    max_zoom INTEGER,
                    tile_type TEXT,
                    band_count INTEGER,
                    rescale TEXT,
                    workspace_id TEXT,
                    is_categorical BOOLEAN NOT NULL DEFAULT 0,
                    categories_json TEXT,
                    created_at TIMESTAMP NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE datasets (
                    id TEXT PRIMARY KEY,
                    name TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE stories (
                    id TEXT PRIMARY KEY,
                    title TEXT
                )
                """
            )
        )
        conn.commit()


def test_migrate_schema_adds_all_connection_conversion_columns(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'drift.db'}")
    _create_pre_ticket_b_schema(engine)

    _migrate_schema(engine)

    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("connections")}
    # These are the columns introduced by the server-side GeoParquet
    # conversion work that must be present for POST /api/connections to
    # succeed against a pre-existing DB.
    expected = {
        "tile_url",
        "render_path",
        "conversion_status",
        "conversion_error",
        "feature_count",
        "file_size",
    }
    missing = expected - columns
    assert not missing, f"_migrate_schema failed to add columns: {missing}"
