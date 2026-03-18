"""Cross-file validation for temporal stacks."""

import rasterio
from rasterio.warp import transform_bounds


def _read_cog_metadata(path: str) -> dict:
    with rasterio.open(path) as src:
        if src.crs and str(src.crs) != "EPSG:4326":
            bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
        else:
            b = src.bounds
            bounds = (b.left, b.bottom, b.right, b.top)
        return {
            "crs": str(src.crs),
            "width": src.width,
            "height": src.height,
            "bands": src.count,
            "bounds": bounds,
        }


def validate_cross_file_compatibility(cog_paths: list[str]) -> list[str]:
    """Check that all COGs are spatially compatible.

    Returns a list of error strings. Empty list means all files are compatible.
    """
    if len(cog_paths) < 2:
        return []

    errors = []
    reference = _read_cog_metadata(cog_paths[0])
    ref_name = cog_paths[0].rsplit("/", 1)[-1]

    for path in cog_paths[1:]:
        name = path.rsplit("/", 1)[-1]
        meta = _read_cog_metadata(path)

        if meta["crs"] != reference["crs"]:
            errors.append(f"CRS mismatch: {name} has {meta['crs']}, expected {reference['crs']} (from {ref_name})")

        if meta["width"] != reference["width"] or meta["height"] != reference["height"]:
            errors.append(
                f"Pixel dimensions mismatch: {name} is {meta['width']}×{meta['height']}, "
                f"expected {reference['width']}×{reference['height']} (from {ref_name})"
            )

        if meta["bands"] != reference["bands"]:
            errors.append(f"Band count mismatch: {name} has {meta['bands']} bands, expected {reference['bands']} (from {ref_name})")

        # Bounds tolerance: 1e-4 degrees (~11m)
        for i, label in enumerate(["west", "south", "east", "north"]):
            if abs(meta["bounds"][i] - reference["bounds"][i]) > 1e-4:
                errors.append(f"Bounding box mismatch ({label}): {name} differs from {ref_name}")
                break

    return errors


def compute_global_stats(cog_paths: list[str]) -> tuple[float, float]:
    """Compute the global min and max pixel values across all COGs."""
    import numpy as np

    global_min = float("inf")
    global_max = float("-inf")

    for path in cog_paths:
        with rasterio.open(path) as src:
            for band_idx in range(1, src.count + 1):
                data = src.read(band_idx).astype(np.float64)
                # Filter out nodata values
                if src.nodata is not None:
                    valid = data[data != src.nodata]
                else:
                    valid = data.ravel()
                if valid.size > 0:
                    global_min = min(global_min, float(np.nanmin(valid)))
                    global_max = max(global_max, float(np.nanmax(valid)))

    if global_min == float("inf"):
        return 0.0, 1.0
    return global_min, global_max
