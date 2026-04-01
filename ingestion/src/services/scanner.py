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

_TIME_NAMES = {"time", "t", "datetime"}


def _find_time_dataset(grp: h5py.Group, root: h5py.File) -> dict | None:
    """Search grp and its ancestors for a 1D time dataset."""
    candidates = [grp]
    parent_path = grp.name
    while parent_path and parent_path != "/":
        parent_path = parent_path.rsplit("/", 1)[0] or "/"
        candidates.append(root[parent_path])

    for group in candidates:
        for key in group:
            if key.lower() not in _TIME_NAMES:
                continue
            ds = group[key]
            if not isinstance(ds, h5py.Dataset) or ds.ndim != 1:
                continue
            size = ds.shape[0]
            units = ds.attrs.get("units", None)
            values = None
            if units is not None:
                if isinstance(units, bytes):
                    units = units.decode()
                try:
                    import cftime

                    dates = cftime.num2date(ds[:], units)
                    values = [d.strftime("%Y-%m-%dT%H:%M:%SZ") for d in dates]
                except (ValueError, TypeError, OverflowError):
                    pass
            return {"name": key, "size": size, "values": values}
    return None


def scan_hdf5(path: str) -> list[dict]:
    """Walk an HDF5 file and return eligible 2D/3D raster variables."""
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
            if basename.lower() in _TIME_NAMES:
                return
            is_complex = obj.dtype.kind == "c"
            group_path = name.rsplit("/", 1)[0] if "/" in name else ""
            grp = f[group_path] if group_path else f

            if obj.ndim == 3:
                time_dim_info = _find_time_dataset(grp, f)
                if time_dim_info is None:
                    time_dim_info = {
                        "name": "dim0",
                        "size": obj.shape[0],
                        "values": None,
                    }
                shape = list(obj.shape[1:])
            else:
                time_dim_info = None
                shape = list(obj.shape)

            variables.append(
                {
                    "name": basename,
                    "group": group_path,
                    "shape": shape,
                    "dtype": str(obj.dtype),
                    "is_complex": is_complex,
                    "time_dim": time_dim_info,
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
                        for v in da[td].values.astype("datetime64[ms]").astype("object")
                    ]
                except (ValueError, TypeError, OverflowError, AttributeError):
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
