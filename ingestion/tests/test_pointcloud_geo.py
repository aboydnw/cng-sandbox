from pyproj import Transformer

from src.services.pointcloud_geo import wgs84_bounds


def test_wgs84_bounds_wider_than_two_corner_for_conic_crs():
    lambert = "EPSG:2992"
    native = [500_000.0, 200_000.0, 900_000.0, 600_000.0]

    result = wgs84_bounds(native, lambert)

    two_corner = Transformer.from_crs(lambert, "EPSG:4326", always_xy=True)
    minx, miny = two_corner.transform(native[0], native[1])
    maxx, maxy = two_corner.transform(native[2], native[3])

    assert result[0] <= minx
    assert result[1] <= miny
    assert result[2] >= maxx
    assert result[3] >= maxy
    assert (result[2] - result[0]) > (maxx - minx)


def test_wgs84_bounds_returns_four_floats():
    result = wgs84_bounds([500_000.0, 200_000.0, 900_000.0, 600_000.0], "EPSG:2992")
    assert len(result) == 4
    assert all(isinstance(v, float) for v in result)
