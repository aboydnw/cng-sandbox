"""Map pipeline exceptions to user-friendly error messages."""

import json


def map_pipeline_error(exc: Exception) -> str:
    """Translate a pipeline exception into a plain-language error message."""
    try:
        import rasterio.errors

        if isinstance(exc, rasterio.errors.RasterioIOError):
            return "Could not read this file as a raster. It may be corrupted or in an unsupported format."
        if isinstance(exc, rasterio.errors.CRSError):
            return "This file has a coordinate reference system that could not be interpreted."
    except ImportError:
        pass

    try:
        import fiona.errors

        if isinstance(exc, fiona.errors.DriverError):
            return "Could not read this file as a vector dataset. It may be corrupted or in an unsupported format."
    except ImportError:
        pass

    if isinstance(exc, json.JSONDecodeError):
        return "This file is not valid JSON. Check that it is a properly formatted GeoJSON file."

    return str(exc)
