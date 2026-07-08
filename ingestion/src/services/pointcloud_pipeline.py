"""Point-cloud pipeline: scan LAS/LAZ -> PDAL COPC -> validate -> store."""

import logging
from dataclasses import dataclass

import laspy

logger = logging.getLogger(__name__)


@dataclass
class LasScan:
    point_count: int
    native_bounds: list[float]
    crs: str | None
    crs_wkt: str | None


def scan_las_header(path: str) -> LasScan:
    """Read a LAS/LAZ header + VLRs for point count, native bounds, and CRS."""
    with laspy.open(path) as reader:
        header = reader.header
        crs = header.parse_crs()
        return LasScan(
            point_count=header.point_count,
            native_bounds=[header.x_min, header.y_min, header.x_max, header.y_max],
            crs=f"EPSG:{crs.to_epsg()}" if crs and crs.to_epsg() else None,
            crs_wkt=crs.to_wkt() if crs else None,
        )
