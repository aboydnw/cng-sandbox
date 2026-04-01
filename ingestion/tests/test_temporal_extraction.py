import numpy as np
import pytest


@pytest.fixture
def temporal_netcdf(tmp_path):
    import xarray as xr

    path = tmp_path / "temporal.nc"
    ds = xr.Dataset(
        {
            "temperature": (
                ["time", "lat", "lon"],
                np.stack(
                    [np.full((180, 360), i, dtype=np.float32) for i in range(6)]
                ),
            ),
        },
        coords={
            "time": xr.date_range("2020-01-01", periods=6, freq="MS"),
            "lat": np.linspace(-90, 90, 180),
            "lon": np.linspace(-180, 180, 360),
        },
    )
    ds.to_netcdf(str(path))
    return str(path)


def test_extract_temporal_cogs_produces_correct_count(temporal_netcdf, tmp_path):
    from src.models import FormatPair
    from src.services.temporal_pipeline import extract_temporal_cogs

    cog_paths, datetimes = extract_temporal_cogs(
        input_path=temporal_netcdf,
        output_dir=str(tmp_path / "cogs"),
        format_pair=FormatPair.NETCDF_TO_COG,
        variable="temperature",
        group="",
        start_index=0,
        end_index=5,
    )
    assert len(cog_paths) == 6
    assert len(datetimes) == 6
    for p in cog_paths:
        assert p.endswith(".tif")


def test_extract_temporal_cogs_subset(temporal_netcdf, tmp_path):
    from src.models import FormatPair
    from src.services.temporal_pipeline import extract_temporal_cogs

    cog_paths, datetimes = extract_temporal_cogs(
        input_path=temporal_netcdf,
        output_dir=str(tmp_path / "cogs"),
        format_pair=FormatPair.NETCDF_TO_COG,
        variable="temperature",
        group="",
        start_index=2,
        end_index=4,
    )
    assert len(cog_paths) == 3
    assert len(datetimes) == 3
