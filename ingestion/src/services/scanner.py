"""Variable discovery for HDF5 and NetCDF files."""

import h5py
import xarray as xr

_COORD_NAMES = {
    "xcoordinates",
    "ycoordinates",
    "x",
    "y",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "xcoordinatespacing",
    "ycoordinatespacing",
    "easegridcolumnindex",
    "easegridrowindex",
}


def scan_hdf5(path: str) -> list[dict]:
    """Walk an HDF5 file and return eligible 2D raster variables."""
    variables = []
    with h5py.File(path, "r") as f:

        def _visit(name, obj):
            if not isinstance(obj, h5py.Dataset):
                return
            if obj.ndim < 2:
                return
            if obj.dtype.kind in ("S", "U", "O"):
                return
            is_complex = obj.dtype.kind == "c"
            basename = name.rsplit("/", 1)[-1]
            if basename.lower() in _COORD_NAMES:
                return
            group = name.rsplit("/", 1)[0] if "/" in name else ""
            variables.append(
                {
                    "name": basename,
                    "group": group,
                    "shape": list(obj.shape),
                    "dtype": str(obj.dtype),
                    "is_complex": is_complex,
                }
            )

        f.visititems(_visit)
    return variables


def scan_netcdf(path: str) -> list[dict]:
    """List eligible data variables from a NetCDF file."""
    variables = []
    with xr.open_dataset(path) as ds:
        for name in ds.data_vars:
            da = ds[name]
            time_dims = [d for d in da.dims if d.lower() in ("time", "t")]
            spatial_dims = [d for d in da.dims if d.lower() not in ("time", "t")]
            if len(spatial_dims) < 2:
                continue

            time_dim_info = None
            if len(time_dims) == 1 and len(spatial_dims) == 2:
                td = time_dims[0]
                size = da.sizes[td]
                try:
                    values = [
                        v.isoformat().replace("+00:00", "") + "Z"
                        for v in da[td].values.astype("datetime64[ms]").astype(
                            "object"
                        )
                    ]
                except (ValueError, TypeError, OverflowError):
                    values = None
                time_dim_info = {"name": str(td), "size": size, "values": values}

            spatial_shape = [da.sizes[d] for d in spatial_dims]
            variables.append(
                {
                    "name": str(name),
                    "group": "",
                    "shape": spatial_shape,
                    "dtype": str(da.dtype),
                    "time_dim": time_dim_info,
                }
            )
    return variables
