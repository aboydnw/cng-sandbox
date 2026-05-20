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


def is_available() -> bool:
    return (RUNTIME_DIR / "bundle.js").is_file()


def copy_into(staging_dir: Path) -> None:
    """Copy the runtime bundle into ``staging_dir/runtime/``.

    No-op when the runtime is not available on disk (dev mode). Callers should
    use :func:`is_available` to decide whether to emit the real shell or the
    placeholder.
    """
    runtime_target = staging_dir / "runtime"
    runtime_target.mkdir(parents=True, exist_ok=True)
    if not is_available():
        return
    for name in ("bundle.js", "bundle.css"):
        src = RUNTIME_DIR / name
        if src.is_file():
            shutil.copy2(src, runtime_target / name)
