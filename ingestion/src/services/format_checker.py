"""Pre-upload format validation using rasterio and fiona."""

import logging

from src.models import FormatPair
from src.services.detector import (
    UnsupportedFormatError,
    detect_format,
    validate_magic_bytes,
)

logger = logging.getLogger(__name__)


def check_format(file_path: str, filename: str) -> dict:
    """Validate a file's format and return a result dict.

    Returns {"valid": True} on success or {"valid": False, "error": "..."} on failure.
    """
    try:
        format_pair = detect_format(filename)
    except UnsupportedFormatError as e:
        return {"valid": False, "error": str(e)}

    try:
        validate_magic_bytes(file_path, format_pair)
    except UnsupportedFormatError as e:
        return {"valid": False, "error": str(e)}
    except Exception:
        logger.exception("Unexpected error checking file signature")
        return {
            "valid": False,
            "error": "Could not inspect this file's content signature.",
        }

    if format_pair.dataset_type.value == "raster":
        return _check_raster(file_path, format_pair)
    return _check_vector(file_path, format_pair)


def _check_raster(file_path: str, format_pair: FormatPair) -> dict:
    """Validate raster file with rasterio."""
    import rasterio

    format_label = {
        FormatPair.GEOTIFF_TO_COG: "GeoTIFF",
        FormatPair.NETCDF_TO_COG: "NetCDF",
        FormatPair.HDF5_TO_COG: "HDF5",
    }.get(format_pair, "raster")

    try:
        with rasterio.open(file_path) as ds:
            if ds.crs is None:
                return {
                    "valid": False,
                    "error": f"This {format_label} does not have a coordinate reference system (CRS) defined.",
                }
            if ds.count == 0:
                return {
                    "valid": False,
                    "error": f"This {format_label} has no data bands.",
                }
            if ds.width == 0 or ds.height == 0:
                return {
                    "valid": False,
                    "error": f"This {format_label} has zero-sized dimensions ({ds.width}x{ds.height}).",
                }
    except rasterio.errors.RasterioIOError:
        return {
            "valid": False,
            "error": f"Could not read this file as a {format_label}. It may be corrupted or in an unsupported variant.",
        }
    except Exception:
        logger.exception("Unexpected error checking raster")
        return {
            "valid": False,
            "error": f"Could not validate this {format_label}.",
        }

    return {"valid": True}


def _check_vector(file_path: str, format_pair: FormatPair) -> dict:
    """Validate vector file with fiona."""
    import fiona

    format_label = {
        FormatPair.GEOJSON_TO_GEOPARQUET: "GeoJSON",
        FormatPair.SHAPEFILE_TO_GEOPARQUET: "Shapefile",
    }.get(format_pair, "vector")

    try:
        with fiona.open(file_path) as src:
            if len(src) == 0:
                return {
                    "valid": False,
                    "error": f"This {format_label} contains no features.",
                }
    except fiona.errors.DriverError:
        return {
            "valid": False,
            "error": f"Could not read this file as a {format_label}. It may be corrupted or in an unsupported variant.",
        }
    except Exception:
        logger.exception("Unexpected error checking vector")
        return {
            "valid": False,
            "error": f"Could not validate this {format_label}.",
        }

    return {"valid": True}
