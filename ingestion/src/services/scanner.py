"""Variable discovery for HDF5 and NetCDF files."""

import h5py
import xarray as xr

_COORD_NAMES = {
    "xcoordinates", "ycoordinates", "x", "y",
    "latitude", "longitude", "lat", "lon",
    "xcoordinatespacing", "ycoordinatespacing",
    "easegridcolumnindex", "easegridrowindex",
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
            basename = name.rsplit("/", 1)[-1]
            if basename.lower() in _COORD_NAMES:
                return
            group = name.rsplit("/", 1)[0] if "/" in name else ""
            variables.append({
                "name": basename,
                "group": group,
                "shape": list(obj.shape),
                "dtype": str(obj.dtype),
            })
        f.visititems(_visit)
    return variables


def scan_netcdf(path: str) -> list[dict]:
    """List eligible data variables from a NetCDF file."""
    variables = []
    with xr.open_dataset(path) as ds:
        for name in ds.data_vars:
            da = ds[name]
            spatial_dims = [d for d in da.dims if d.lower() not in ("time", "t")]
            if len(spatial_dims) < 2:
                continue
            variables.append({
                "name": str(name),
                "group": "",
                "shape": list(da.shape),
                "dtype": str(da.dtype),
            })
    return variables
