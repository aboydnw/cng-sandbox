"""Geographic helpers shared by the point-cloud pipeline and URL inspection."""


def wgs84_bounds(native_bounds: list[float], crs: str) -> list[float]:
    """Reproject [minx, miny, maxx, maxy] from a source CRS to WGS84 lon/lat."""
    from pyproj import Transformer

    transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    minx, miny = transformer.transform(native_bounds[0], native_bounds[1])
    maxx, maxy = transformer.transform(native_bounds[2], native_bounds[3])
    return [minx, miny, maxx, maxy]
