# Skill: LAS/LAZ to Cloud-Optimized Point Cloud (COPC)

## When to use

When you have a LAS or LAZ point cloud and need to convert it to a Cloud-Optimized Point Cloud (COPC) for efficient, streaming, viewport-LOD access over HTTP range requests (e.g. rendering with `copc.js` / `maplibre-gl-lidar` in the browser).

## Prerequisites

- PDAL CLI (`pdal translate`, `pdal info`) — install via conda-forge (`pdal`) or apt (`pdal`)
- Python 3.10+ (for validation script)
- `pip install "laspy[lazrs]" pyproj`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/validate.py`](scripts/validate.py) | Validate that a COPC preserves all data from the source LAS/LAZ |

## Quickstart

Convert a file with PDAL and validate the result. `--writers.copc.forward=all` carries the source header fields (including the CRS VLR) into the COPC output.

    # Convert LAS/LAZ to COPC:
    pdal translate input.laz output.copc.laz --writers.copc.forward=all

    # Validate the result:
    pip install "laspy[lazrs]" pyproj
    python scripts/validate.py --input input.laz --output output.copc.laz

## Checks

| Check | What it asserts |
|-------|-----------------|
| `check_copc_vlr_present` | The COPC info VLR (`user_id="copc"`, `record_id=1`) is present — i.e. the output really is COPC, not plain LAZ. |
| `check_copc_hierarchy_readable` | `pdal info --summary` reads the octree hierarchy without error. |
| `check_point_count_preserved` | Header point count is identical on both sides. |
| `check_crs_preserved` | `parse_crs().to_epsg()` is identical on both sides. |
| `check_bounds_match` | Header min/max x/y/z match within a 1e-3 tolerance. |

## Known complexity

- **CRS is mandatory downstream.** The browser renderer reprojects points to Web Mercator with `proj4`, so a COPC with no CRS cannot be placed on the map. The sandbox ingestion pipeline hard-fails a point cloud with no CRS before conversion. Validate CRS presence with laspy's `header.parse_crs()`.
- **No pgSTAC/tipg registration.** Unlike rasters/vectors, COPC files are stored to object storage and streamed directly by the browser via HTTP range requests — there is no tile server in the loop.

## Known failure modes

- **`writers.copc` drops the CRS without `forward=all`.** A bare `pdal translate in.laz out.copc.laz` can produce a COPC whose header omits the projection VLR, so the browser cannot reproject the points and the layer renders at [0,0] or not at all. Fix: always pass `--writers.copc.forward=all` so the source SRS/header fields carry through. `check_crs_preserved` catches a dropped CRS.
- **python-magic reports `.laz` as `application/octet-stream`.** LAZ has no dedicated libmagic signature, so MIME-based format detection is ambiguous. The sandbox pipeline adds a stricter guard that reads the first 4 bytes and requires the `LASF` magic. Any format check that trusts MIME alone will misroute or reject valid LAZ files.

## Changelog

- 2026-07-08: Initial skill. Added `check_copc_vlr_present`, `check_copc_hierarchy_readable`, `check_point_count_preserved`, `check_crs_preserved`, `check_bounds_match`. Documented the `writers.copc.forward=all` CRS-drop failure mode and the `.laz` → `application/octet-stream` magic-byte ambiguity.
