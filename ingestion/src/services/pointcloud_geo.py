"""Geographic helpers shared by the point-cloud pipeline and URL inspection."""


def wgs84_bounds(native_bounds: list[float], crs: str) -> list[float]:
    """Reproject [minx, miny, maxx, maxy] from a source CRS to WGS84 lon/lat.

    Uses ``Transformer.transform_bounds``, which samples along the edges of the
    box rather than only reprojecting the two corners. For non-affine
    projections (e.g. Lambert Conformal Conic, common for lidar) the true WGS84
    envelope bows out beyond the transformed corners, so a two-corner transform
    would under-cover the real extent.
    """
    from pyproj import Transformer

    transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    minx, miny, maxx, maxy = transformer.transform_bounds(
        native_bounds[0], native_bounds[1], native_bounds[2], native_bounds[3]
    )
    return [minx, miny, maxx, maxy]
