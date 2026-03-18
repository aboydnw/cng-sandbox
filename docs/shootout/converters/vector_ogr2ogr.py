"""Convert Shapefile/GeoJSON to GeoParquet using ogr2ogr."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "ogr2ogr"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "ogr2ogr", "-f", "Parquet",
        str(output_path), str(input_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
