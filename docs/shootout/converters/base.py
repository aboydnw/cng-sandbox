"""Shared types for converter wrappers."""

import dataclasses
import shutil
import subprocess
import time
from pathlib import Path


@dataclasses.dataclass
class ConverterResult:
    tool: str
    status: str  # "success", "error", "skipped"
    error_message: str | None
    duration_seconds: float


def run_cli(tool_name: str, cmd: list[str], output_path: Path,
            timeout: int = 300) -> ConverterResult:
    """Run a CLI conversion command and return a ConverterResult."""
    start = time.monotonic()
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        elapsed = time.monotonic() - start
        if result.returncode != 0:
            return ConverterResult(
                tool=tool_name, status="error",
                error_message=result.stderr.strip() or result.stdout.strip(),
                duration_seconds=elapsed,
            )
        if not output_path.exists():
            return ConverterResult(
                tool=tool_name, status="error",
                error_message="Command succeeded but output file not found",
                duration_seconds=elapsed,
            )
        return ConverterResult(
            tool=tool_name, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except FileNotFoundError:
        return ConverterResult(
            tool=tool_name, status="skipped",
            error_message=f"{cmd[0]!r} not found on PATH",
            duration_seconds=0.0,
        )
    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=tool_name, status="error",
            error_message=f"Timed out after {timeout}s",
            duration_seconds=elapsed,
        )


def check_tool_available(name: str) -> bool:
    """Check if a CLI tool is available on PATH."""
    return shutil.which(name) is not None
