"""Placeholder index.html + manifest.json writer for interactive story export.

Plan 2 will replace the placeholder HTML with the real archive-runtime shell.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PLACEHOLDER_INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Interactive story export (placeholder)</title>
</head>
<body>
  <h1>Interactive story export</h1>
  <p>
    The archive runtime has not been bundled into this export yet.
    See manifest.json for chapter data.
  </p>
</body>
</html>
"""


def write_shell(staging_dir: Path, manifest: dict[str, Any]) -> None:
    """Write the placeholder index.html and the manifest.json into staging."""
    (staging_dir / "index.html").write_text(PLACEHOLDER_INDEX_HTML, encoding="utf-8")
    (staging_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
