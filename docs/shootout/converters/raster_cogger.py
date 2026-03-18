"""Convert GeoTIFF to COG using cogger (Rust-based, best-effort)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "cogger"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "cogger", "translate",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
