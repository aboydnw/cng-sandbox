"""Locates the pre-built archive-runtime bundle and copies it into export zips.

The runtime is built by the ``archive-runtime`` CI job and baked into the
ingestion Docker image at ``/app/runtime_assets``. In local dev (running
ingestion without Docker), the runtime directory may not exist — this module
degrades gracefully and ``html_shell`` falls back to the placeholder.
"""

from __future__ import annotations

import shutil
from pathlib import Path

RUNTIME_DIR = Path("/app/runtime_assets")
"""Where the Docker image stages the built bundle. Patchable in tests."""


_REQUIRED_FILES = ("bundle.js", "bundle.css")


def is_available() -> bool:
    return all((RUNTIME_DIR / name).is_file() for name in _REQUIRED_FILES)


def copy_into(staging_dir: Path) -> None:
    """Copy the runtime bundle into ``staging_dir/runtime/``.

    No-op when the runtime is not available on disk (dev mode). Callers should
    use :func:`is_available` to decide whether to emit the real shell or the
    placeholder.
    """
    if not is_available():
        return
    runtime_target = staging_dir / "runtime"
    runtime_target.mkdir(parents=True, exist_ok=True)
    for name in _REQUIRED_FILES:
        shutil.copy2(RUNTIME_DIR / name, runtime_target / name)
