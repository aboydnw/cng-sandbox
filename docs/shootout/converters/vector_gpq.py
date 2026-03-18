"""Convert GeoJSON to GeoParquet using gpq (GeoJSON only, not Shapefile)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "gpq"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "gpq", "convert",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
