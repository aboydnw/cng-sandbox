"""index.html + manifest.json writer for interactive story export.

When the archive runtime bundle is available on disk, the shell loads it via a
``<script src="./runtime/bundle.js">`` tag and the page bootstraps into the full
interactive renderer. When the runtime is not available (local dev without the
Docker bake), a placeholder HTML is written instead so the endpoint still
returns a coherent — if non-interactive — zip.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.services.interactive_export import runtime_assets

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


def _real_shell(story_title: str) -> str:
    safe_title = (story_title or "Story").replace("</", "<\\/")
    return f"""<!doctype html>
<html lang=\"en\" data-base-path=\".\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>{safe_title}</title>
  <link rel=\"stylesheet\" href=\"./runtime/bundle.css\" />
</head>
<body>
  <article id=\"story\"></article>
  <script src=\"./runtime/bundle.js\"></script>
</body>
</html>
"""


def write_shell(staging_dir: Path, manifest: dict[str, Any]) -> None:
    if runtime_assets.is_available():
        (staging_dir / "index.html").write_text(
            _real_shell(manifest.get("story", {}).get("title", "")), encoding="utf-8"
        )
    else:
        (staging_dir / "index.html").write_text(
            PLACEHOLDER_INDEX_HTML, encoding="utf-8"
        )
    (staging_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
