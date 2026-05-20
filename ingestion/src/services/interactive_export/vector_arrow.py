"""Clip vector features to a chapter bbox and write GeoArrow IPC."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pyarrow as pa
import pyarrow.ipc as ipc
from shapely.geometry import box

MAX_ARROW_BYTES = 100 * 1024 * 1024


def write_arrow(
    source_url: str,
    bbox: tuple[float, float, float, float],
    keep_columns: list[str],
    output_path: Path,
) -> None:
    """Read a vector source, clip to bbox, write GeoArrow IPC stream.

    Args:
        source_url: Path or URL to GeoJSON or GeoParquet source.
        bbox: (minx, miny, maxx, maxy) in EPSG:4326.
        keep_columns: Non-geometry columns to retain. Empty list keeps geometry only.
        output_path: Where to write the .arrow file.
    """
    src = str(source_url)
    gdf = gpd.read_parquet(src) if src.endswith(".parquet") else gpd.read_file(src)

    if gdf.crs is None:
        gdf = gdf.set_crs(4326)

    clip_gs = gpd.GeoSeries([box(*bbox)], crs=4326)
    if gdf.crs.to_epsg() != 4326:
        clip_gs = clip_gs.to_crs(gdf.crs)
    clip_geom = clip_gs.iloc[0]
    clipped = gdf[gdf.intersects(clip_geom)].copy()

    cols = [c for c in keep_columns if c in clipped.columns]
    geom_wkb = clipped.geometry.apply(lambda g: g.wkb if g is not None else None)
    attr_arrays = {c: pa.array(clipped[c].tolist()) for c in cols}

    geom_array = pa.array(geom_wkb.tolist(), type=pa.binary())
    geom_field = pa.field(
        "geometry",
        pa.binary(),
        metadata={
            b"ARROW:extension:name": b"geoarrow.wkb",
            b"ARROW:extension:metadata": b"{}",
        },
    )

    schema_fields = [pa.field(c, attr_arrays[c].type) for c in cols]
    schema_fields.append(geom_field)
    schema = pa.schema(schema_fields)

    arrays = [attr_arrays[c] for c in cols]
    arrays.append(geom_array)
    table = pa.Table.from_arrays(arrays, schema=schema)

    with ipc.new_stream(output_path, schema) as writer:
        writer.write_table(table)

    size = output_path.stat().st_size
    if size > MAX_ARROW_BYTES:
        output_path.unlink(missing_ok=True)
        raise ValueError(
            f"vector chapter Arrow output too large: {size} bytes "
            f"(cap {MAX_ARROW_BYTES})"
        )
