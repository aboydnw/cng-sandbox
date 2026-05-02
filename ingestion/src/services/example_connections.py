"""Startup task: seed curated example connections (e.g. zarr URLs).

On ingestion boot, register each entry in `EXAMPLE_CONNECTIONS` as a
`ConnectionRow` with `is_example=True` and `workspace_id=None`. Idempotent
across restarts: the `(url, connection_type)` pair is the seed key, so
re-runs skip already-present rows. Mirrors the pattern in
`example_datasets.py` / `example_stories.py`.

The list of curated connections is intentionally short at MVP (one zarr
store). Add new entries to `EXAMPLE_CONNECTIONS` to grow the seed.
"""

from __future__ import annotations

import json
import logging
import math
import struct
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import zstandard
from sqlalchemy.orm import sessionmaker

from src.models.connection import ConnectionRow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExampleConnectionSeed:
    """A curated connection that ships with every fresh deploy."""

    name: str
    url: str
    connection_type: str
    config: dict[str, Any] = field(default_factory=dict)
    bounds: list[float] | None = None
    rescale: str | None = None
    band_count: int | None = None
    tile_type: str | None = None
    preferred_colormap: str | None = None
    preferred_colormap_reversed: bool | None = None
    zarr_time_dim: str | None = None
    zarr_max_steps: int = 5000
    geozarr_attrs: dict[str, Any] | None = None


EXAMPLE_CONNECTIONS: list[ExampleConnectionSeed] = [
    ExampleConnectionSeed(
        name="IMERG Final Precipitation",
        url="https://data.source.coop/bkr/imerg/imerg_final.zarr",
        connection_type="zarr",
        bounds=[-180.0, -90.0, 180.0, 90.0],
        config={
            "variable": "precipitation",
            "timeDim": "time",
            "rescaleMin": 0,
            "rescaleMax": 30,
        },
        preferred_colormap="blues",
        zarr_time_dim="time",
        geozarr_attrs={
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        },
    ),
]


def _probe_zarr_timesteps(
    url: str,
    time_dim: str,
    max_steps: int = 5000,
) -> list[dict[str, Any]]:
    """Fetch and decimate a zarr v3 time coordinate.

    Downloads only the chunks needed for the decimated indices (typically
    ~8 HTTP requests for a 473k-element time axis with chunk_shape=59167).
    Assumes int64 little-endian data encoded with zstd compression.

    Returns a list of {datetime: ISO8601, index: int} dicts sorted by index.
    Raises on any network or decode error.
    """
    max_steps = max(1, int(max_steps))
    base = url.rstrip("/")
    meta = (
        httpx.get(f"{base}/{time_dim}/zarr.json", timeout=30.0)
        .raise_for_status()
        .json()
    )

    shape: int = meta["shape"][0]
    chunk_shape: int = meta["chunk_grid"]["configuration"]["chunk_shape"][0]
    units: str = meta["attributes"]["units"]

    epoch_str = units.split("since", 1)[-1].strip()
    epoch = datetime.fromisoformat(epoch_str).replace(tzinfo=UTC)

    stride = max(1, math.ceil(shape / max_steps))
    needed_indices = list(range(0, shape, stride))
    if shape and needed_indices[-1] != shape - 1:
        if len(needed_indices) >= max_steps:
            needed_indices[-1] = shape - 1
        else:
            needed_indices.append(shape - 1)

    chunk_to_indices: dict[int, list[int]] = defaultdict(list)
    for idx in needed_indices:
        chunk_to_indices[idx // chunk_shape].append(idx)

    dctx = zstandard.ZstdDecompressor()
    results: list[dict[str, Any]] = []

    for chunk_idx in sorted(chunk_to_indices):
        chunk_url = f"{base}/{time_dim}/c/{chunk_idx}"
        resp = httpx.get(chunk_url, timeout=60.0)
        resp.raise_for_status()
        raw = dctx.decompress(resp.content)

        n_elements = len(raw) // 8
        values = struct.unpack_from(f"<{n_elements}q", raw)

        for idx in chunk_to_indices[chunk_idx]:
            local_idx = idx - chunk_idx * chunk_shape
            ns = values[local_idx]
            dt = epoch + timedelta(microseconds=ns // 1000)
            results.append(
                {"datetime": dt.strftime("%Y-%m-%dT%H:%M:%SZ"), "index": idx}
            )

    results.sort(key=lambda x: x["index"])
    return results


def _existing_connection_keys(
    db_session_factory: sessionmaker,
) -> set[tuple[str, str]]:
    """Return {(url, connection_type)} for every ConnectionRow.

    We dedupe against ALL existing rows (not just `is_example=True`) so that
    a pre-existing user-owned connection with the same `(url, connection_type)`
    is not duplicated as an example row.
    """
    session = db_session_factory()
    try:
        rows = session.query(ConnectionRow).all()
        return {(r.url, r.connection_type) for r in rows}
    finally:
        session.close()


def seed_example_connections(db_session_factory: sessionmaker) -> None:
    """Insert every entry in `EXAMPLE_CONNECTIONS` not already present.

    Idempotent: a `(url, connection_type)` pair already present in the
    `connections` table is skipped, regardless of whether the existing row
    is an example row or a workspace-owned row. Errors on individual seeds
    are logged but do not abort the rest of the batch.

    For seeds with `zarr_time_dim` set, the time coordinate is fetched from
    the remote store at startup and decimated to `zarr_max_steps` entries.
    If the probe fails, that seed is skipped with a warning.
    """
    if not EXAMPLE_CONNECTIONS:
        logger.info("No example connections defined; skipping seed")
        return
    existing = _existing_connection_keys(db_session_factory)
    session = db_session_factory()
    try:
        for seed in EXAMPLE_CONNECTIONS:
            key = (seed.url, seed.connection_type)
            if key in existing:
                logger.info(
                    "example connection already present, skipping: %s", seed.name
                )
                continue

            config: dict[str, Any] = dict(seed.config)

            if seed.zarr_time_dim:
                try:
                    logger.info(
                        "probing zarr time axis for %s (%s)…", seed.name, seed.url
                    )
                    timesteps = _probe_zarr_timesteps(
                        seed.url, seed.zarr_time_dim, seed.zarr_max_steps
                    )
                    config["timesteps"] = timesteps
                    logger.info("probed %d timesteps for %s", len(timesteps), seed.name)
                except Exception:
                    logger.exception(
                        "Failed to probe zarr time axis for %s; skipping seed",
                        seed.name,
                    )
                    continue

            try:
                row = ConnectionRow(
                    id=str(uuid.uuid4()),
                    name=seed.name,
                    url=seed.url,
                    connection_type=seed.connection_type,
                    bounds_json=(json.dumps(seed.bounds) if seed.bounds else None),
                    rescale=seed.rescale,
                    band_count=seed.band_count,
                    tile_type=seed.tile_type,
                    workspace_id=None,
                    is_example=True,
                    config=config or None,
                    geozarr_attrs=seed.geozarr_attrs,
                    preferred_colormap=seed.preferred_colormap,
                    preferred_colormap_reversed=seed.preferred_colormap_reversed,
                    created_at=datetime.now(UTC),
                )
                session.add(row)
                session.commit()
                existing.add(key)
                logger.info("registered example connection: %s", seed.name)
            except Exception:
                session.rollback()
                logger.exception("Failed to register example connection: %s", seed.name)
    finally:
        session.close()
