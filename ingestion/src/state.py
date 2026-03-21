"""Shared mutable state — imported by both app.py and route modules.

Keeps state in a neutral module to avoid circular imports.
Jobs are ephemeral and lost on restart — adequate for v1 demo.
"""

import asyncio

jobs: dict = {}
scan_store: dict = {}
scan_store_lock = asyncio.Lock()
