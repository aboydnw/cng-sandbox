"""Shared mutable state — imported by both app.py and route modules.

Keeps state in a neutral module to avoid circular imports.
Jobs and datasets are ephemeral and lost on restart — adequate for v1 demo.
"""

jobs: dict = {}
datasets: dict = {}
