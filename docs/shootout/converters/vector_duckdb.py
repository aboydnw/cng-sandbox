"""Convert Shapefile/GeoJSON to GeoParquet using DuckDB spatial extension."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "duckdb"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import duckdb
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="duckdb not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        escaped_in = str(input_path).replace("'", "''")
        escaped_out = str(output_path).replace("'", "''")
        con.execute(f"""
            COPY (
                SELECT * FROM ST_Read('{escaped_in}')
            ) TO '{escaped_out}' (FORMAT PARQUET);
        """)
        con.close()
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except Exception as e:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="error",
            error_message=str(e), duration_seconds=elapsed,
        )
