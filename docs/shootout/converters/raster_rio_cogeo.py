"""Convert GeoTIFF to COG using rio-cogeo (our baseline)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "rio-cogeo"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "rio", "cogeo", "create",
        str(input_path), str(output_path),
        "--overview-level", "6",
        "--blocksize", "512",
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
