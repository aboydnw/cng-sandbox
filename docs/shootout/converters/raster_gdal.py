"""Convert GeoTIFF to COG using gdal_translate."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "gdal"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "gdal_translate", "-of", "COG",
        "-co", "COMPRESS=DEFLATE",
        "-co", "BLOCKSIZE=512",
        "-co", "OVERVIEW_COUNT=6",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
