"""Pre-upload format validation using rasterio and geopandas."""

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
    """Validate raster file format.

    Only GeoTIFF is parsed here — its header sits at offset 0 and fits in
    the 1 MB pre-upload chunk, so rasterio can read metadata (CRS, bands,
    dimensions) reliably. NetCDF and HDF5 store metadata at offsets that
    can fall past the 1 MB boundary, so parsing a truncated chunk yields
    false negatives ("not recognized as being in a supported file format").
    Those formats rely on extension + magic-byte checks; full structural
    validation happens downstream in the pipeline.
    """
    if format_pair != FormatPair.GEOTIFF_TO_COG:
        return {"valid": True}

    import rasterio

    try:
        with rasterio.open(file_path) as ds:
            if ds.crs is None:
                return {
                    "valid": False,
                    "error": "This GeoTIFF does not have a coordinate reference system (CRS) defined.",
                }
            if ds.count == 0:
                return {
                    "valid": False,
                    "error": "This GeoTIFF has no data bands.",
                }
            if ds.width == 0 or ds.height == 0:
                return {
                    "valid": False,
                    "error": f"This GeoTIFF has zero-sized dimensions ({ds.width}x{ds.height}).",
                }
    except rasterio.errors.RasterioIOError:
        return {
            "valid": False,
            "error": "Could not read this file as a GeoTIFF. It may be corrupted or in an unsupported variant.",
        }
    except Exception:
        logger.exception("Unexpected error checking raster")
        return {
            "valid": False,
            "error": "Could not validate this GeoTIFF.",
        }

    return {"valid": True}


def _check_vector(file_path: str, format_pair: FormatPair) -> dict:
    """Validate vector file format.

    Only relies on extension and magic-byte checks (done in check_format
    before this is called). Parsing the file is unsafe here because the
    pre-upload endpoint receives only the first 1 MB — any file larger
    than that is truncated, and partial JSON / zip / dbf will always fail
    to parse. Full structural validation happens in the pipeline.
    """
    return {"valid": True}
