"""Format detection via file extension and magic byte validation."""

import os

import magic

from src.models import FormatPair


class UnsupportedFormatError(Exception):
    pass


# Maps MIME types to the format pairs that accept them
_MIME_WHITELIST: dict[FormatPair, set[str]] = {
    FormatPair.GEOTIFF_TO_COG: {"image/tiff"},
    FormatPair.SHAPEFILE_TO_GEOPARQUET: {"application/x-esri-shapefile", "application/octet-stream", "application/dbf", "application/zip"},
    FormatPair.GEOJSON_TO_GEOPARQUET: {"application/json", "text/plain", "application/geo+json"},
    FormatPair.NETCDF_TO_COG: {"application/x-netcdf", "application/octet-stream", "application/x-hdf", "application/x-hdf5"},
    FormatPair.HDF5_TO_COG: {"application/x-hdf5", "application/x-hdf", "application/octet-stream"},
}


def detect_format(filename: str) -> FormatPair:
    """Detect the conversion format pair from a filename's extension."""
    ext = os.path.splitext(filename)[1].lower()
    try:
        return FormatPair.from_extension(ext)
    except ValueError:
        raise UnsupportedFormatError(
            f"Unsupported file format: '{ext}'. "
            f"Accepted: .tif, .tiff, .shp, .zip, .geojson, .json, .nc, .h5, .hdf5"
        )


def validate_magic_bytes(file_path: str, expected_format: FormatPair) -> None:
    """Verify that the file's magic bytes match the expected format."""
    mime = magic.from_file(file_path, mime=True)
    allowed = _MIME_WHITELIST.get(expected_format, set())
    if mime not in allowed:
        raise UnsupportedFormatError(
            f"File content ({mime}) does not match expected format ({expected_format.value}). "
            f"The file may be corrupted or mislabeled."
        )
