"""Build a PMTiles raster pyramid clipped to a chapter bbox.

Pixel values are encoded into RGBA PNG tiles using a terrain-RGB-style scheme so
that the archive runtime's deck.gl-raster pipeline can decode them in-shader and
apply the chapter's colormap at render time.

Decoded value = -10_000 + ((R * 256 * 256 + G * 256 + B) * 0.1).
Alpha encodes nodata mask: 0 for nodata, 255 otherwise.
"""

from __future__ import annotations

import io
import logging
import math
from pathlib import Path

import numpy as np
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from pyproj import CRS
from rasterio.errors import RasterioIOError
from rio_tiler.errors import TileOutsideBounds
from rio_tiler.io import Reader as COGReader

logger = logging.getLogger(__name__)


def _encode_float_to_rgba(values: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Encode float values to RGBA bytes using terrain-RGB scaling."""
    finite = mask & np.isfinite(values)
    scaled = np.where(
        finite,
        ((values + 10_000.0) / 0.1).clip(0, 256**3 - 1),
        0,
    ).astype(np.uint32)
    r = (scaled // (256 * 256)) & 0xFF
    g = (scaled // 256) & 0xFF
    b = scaled & 0xFF
    a = np.where(finite, 255, 0).astype(np.uint8)
    return np.stack(
        [r.astype(np.uint8), g.astype(np.uint8), b.astype(np.uint8), a],
        axis=-1,
    )


def _tiles_covering_bbox(bbox: tuple[float, float, float, float], zoom: int):
    minx, miny, maxx, maxy = bbox
    n = 2**zoom

    def lon_to_tile_x(lon: float) -> int:
        return math.floor((lon + 180.0) / 360.0 * n)

    def lat_to_tile_y(lat: float) -> int:
        rad = math.radians(max(-85.05112878, min(85.05112878, lat)))
        return math.floor(
            (1.0 - math.log(math.tan(rad) + 1.0 / math.cos(rad)) / math.pi) / 2.0 * n
        )

    x0 = max(0, lon_to_tile_x(minx))
    x1 = min(n - 1, lon_to_tile_x(maxx))
    y0 = max(0, lat_to_tile_y(maxy))
    y1 = min(n - 1, lat_to_tile_y(miny))
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            yield x, y


def _encode_tile_png(image_data) -> bytes:
    """Convert a rio-tiler ImageData object's first band into an encoded PNG."""
    values = image_data.data[0].astype("float32")
    mask = (
        image_data.mask.astype(bool)
        if image_data.mask is not None
        else np.ones_like(values, dtype=bool)
    )
    rgba = _encode_float_to_rgba(values, mask)
    pil = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return buf.getvalue()


def build_pyramid(
    source_url: str,
    bbox: tuple[float, float, float, float],
    min_zoom: int,
    max_zoom: int,
    output_path: Path,
) -> None:
    """Build a PMTiles pyramid for the given COG, clipped to bbox.

    Args:
        source_url: Path or URL to the source COG.
        bbox: (minx, miny, maxx, maxy) in EPSG:4326.
        min_zoom, max_zoom: Inclusive zoom range to generate.
        output_path: Where to write the .pmtiles file.

    Raises:
        ValueError: If the source can't be opened (missing file, HTTP error,
            unsupported format) or if bbox does not intersect the source raster.
    """
    try:
        _build_pyramid_inner(source_url, bbox, min_zoom, max_zoom, output_path)
    except RasterioIOError as exc:
        raise ValueError(f"raster source unavailable: {source_url} ({exc})") from exc


def _build_pyramid_inner(
    source_url: str,
    bbox: tuple[float, float, float, float],
    min_zoom: int,
    max_zoom: int,
    output_path: Path,
) -> None:
    with COGReader(source_url) as reader:
        src_bounds = reader.get_geographic_bounds(CRS.from_epsg(4326))
        if (
            bbox[0] > src_bounds[2]
            or bbox[2] < src_bounds[0]
            or bbox[1] > src_bounds[3]
            or bbox[3] < src_bounds[1]
        ):
            raise ValueError(
                f"bbox does not intersect source raster bounds {src_bounds}"
            )

        tile_pngs: list[tuple[int, bytes]] = []
        for z in range(min_zoom, max_zoom + 1):
            for x, y in _tiles_covering_bbox(bbox, z):
                try:
                    img = reader.tile(x, y, z, tilesize=256)
                except TileOutsideBounds:
                    logger.debug(
                        "raster_pyramid: tile %d/%d/%d outside source bounds; skipping",
                        z,
                        x,
                        y,
                    )
                    continue
                except Exception:
                    logger.exception(
                        "raster_pyramid: failed to read tile %d/%d/%d (tile_id=%d)",
                        z,
                        x,
                        y,
                        zxy_to_tileid(z, x, y),
                    )
                    raise
                tile_pngs.append((zxy_to_tileid(z, x, y), _encode_tile_png(img)))

        if not tile_pngs:
            raise ValueError(
                "no tiles were generated for the requested bbox/zoom range"
            )

        tile_pngs.sort(key=lambda kv: kv[0])

        with open(output_path, "wb") as f:
            writer = Writer(f)
            for tile_id, png in tile_pngs:
                writer.write_tile(tile_id, png)

            writer.finalize(
                {
                    "tile_compression": Compression.NONE,
                    "tile_type": TileType.PNG,
                    "min_zoom": min_zoom,
                    "max_zoom": max_zoom,
                    "min_lon_e7": int(bbox[0] * 1e7),
                    "min_lat_e7": int(bbox[1] * 1e7),
                    "max_lon_e7": int(bbox[2] * 1e7),
                    "max_lat_e7": int(bbox[3] * 1e7),
                    "center_zoom": min_zoom,
                    "center_lon_e7": int((bbox[0] + bbox[2]) / 2 * 1e7),
                    "center_lat_e7": int((bbox[1] + bbox[3]) / 2 * 1e7),
                },
                {},
            )
