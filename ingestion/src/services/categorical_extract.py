"""Extract unique integer values from a raster for manual categorical marking."""

import logging

logger = logging.getLogger(__name__)

MAX_UNIQUE_VALUES = 30
SUPPORTED_INT_DTYPES = frozenset(
    {"uint8", "int8", "uint16", "int16", "uint32", "int32"}
)


class UnsupportedDtype(Exception):
    def __init__(self, dtype: str):
        super().__init__(f"Unsupported dtype: {dtype}")
        self.dtype = dtype


class TooManyValues(Exception):
    def __init__(self, count: int):
        super().__init__(f"Found {count} unique values (max {MAX_UNIQUE_VALUES})")
        self.count = count


def _read_sample(src, band: int = 1):
    overviews = src.overviews(band)
    if overviews:
        level = overviews[-1]
        height = max(1, src.height // level)
        width = max(1, src.width // level)
        return src.read(band, out_shape=(height, width))
    target = 512
    if src.height <= target and src.width <= target:
        return src.read(band)
    return src.read(
        band,
        out_shape=(min(target, src.height), min(target, src.width)),
    )


def extract_unique_values(raster_path: str) -> list[int]:
    """Return the sorted unique non-nodata integer values present in band 1.

    Raises UnsupportedDtype for float rasters or TooManyValues if the count
    exceeds MAX_UNIQUE_VALUES.
    """
    import numpy as np
    import rasterio

    with rasterio.open(raster_path) as src:
        dtype = str(src.dtypes[0])
        if dtype not in SUPPORTED_INT_DTYPES:
            raise UnsupportedDtype(dtype)
        data = _read_sample(src, band=1)
        uniques = np.unique(data)
        nodata = src.nodata
        if nodata is not None:
            uniques = uniques[uniques != int(nodata)]
        if len(uniques) > MAX_UNIQUE_VALUES:
            raise TooManyValues(len(uniques))
        return [int(v) for v in sorted(uniques)]
