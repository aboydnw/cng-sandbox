import os
import tempfile

from src.models import FormatPair, Job, StageProgress


def test_validation_check_counts_are_defined():
    from src.services.pipeline import VALIDATION_CHECK_COUNTS as counts

    assert counts[FormatPair.GEOTIFF_TO_COG] == 8
    assert counts[FormatPair.GEOJSON_TO_GEOPARQUET] == 10
    assert counts[FormatPair.SHAPEFILE_TO_GEOPARQUET] == 10
    assert counts[FormatPair.NETCDF_TO_COG] == 8
    assert counts[FormatPair.HDF5_TO_COG] == 7


def test_estimate_output_size_geotiff():
    from src.services.pipeline import _estimate_output_size

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"x" * 1_000_000)
        f.flush()
        estimate = _estimate_output_size(f.name, FormatPair.GEOTIFF_TO_COG)
        assert estimate == 1_000_000  # 1:1 ratio for GeoTIFF
        os.unlink(f.name)


def test_estimate_output_size_vector():
    from src.services.pipeline import _estimate_output_size

    with tempfile.NamedTemporaryFile(suffix=".geojson", delete=False) as f:
        f.write(b"x" * 1_000_000)
        f.flush()
        estimate = _estimate_output_size(f.name, FormatPair.GEOJSON_TO_GEOPARQUET)
        assert estimate == 250_000  # 4:1 compression ratio for vector
        os.unlink(f.name)
