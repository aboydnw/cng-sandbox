"""Convert a GeoTIFF to a Cloud-Optimized GeoTIFF (COG)."""

import argparse
import os
import sys

_REQUIRED = {"rasterio": "rasterio"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)} rio-cogeo")
    sys.exit(1)

try:
    from rio_cogeo import cog_translate
    from rio_cogeo.profiles import cog_profiles
except ImportError:
    print("Missing dependency: rio-cogeo")
    print("Install with: pip install rio-cogeo")
    sys.exit(1)

import rasterio


def convert(input_path: str, output_path: str, compression: str = "DEFLATE", verbose: bool = False):
    """Convert a GeoTIFF to a Cloud-Optimized GeoTIFF.

    If the input is not in EPSG:4326, reprojects to EPSG:4326 first.
    """
    with rasterio.open(input_path) as src:
        if verbose:
            print(f"Input: {src.width}x{src.height}, {src.count} band(s), dtype={src.dtypes[0]}")
            print(f"CRS: {src.crs}")
            print(f"Bounds: {src.bounds}")
        needs_reproject = src.crs != rasterio.crs.CRS.from_epsg(4326)

    if needs_reproject:
        if verbose:
            print("CRS is not EPSG:4326, reprojecting...")
        from cng_shared import reproject_to_cog
        reproject_to_cog(input_path, output_path, compression=compression, verbose=verbose)
    else:
        try:
            output_profile = cog_profiles.get(compression.lower())
        except KeyError:
            output_profile = cog_profiles.get("deflate")
        output_profile["blockxsize"] = 512
        output_profile["blockysize"] = 512
        if verbose:
            print(f"Writing COG with {compression} compression...")
        cog_translate(
            input_path, output_path, output_profile,
            overview_level=6, overview_resampling="nearest",
            quiet=not verbose,
        )

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a GeoTIFF to a Cloud-Optimized GeoTIFF")
    parser.add_argument("--input", required=True, help="Path to input GeoTIFF")
    parser.add_argument("--output", required=True, help="Path for output COG")
    parser.add_argument("--compression", default="DEFLATE", choices=["DEFLATE", "ZSTD", "LZW"],
                        help="Compression method (default: DEFLATE)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".tif", ".tiff"):
        print(f"Error: expected a .tif or .tiff file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, compression=args.compression, verbose=args.verbose)


if __name__ == "__main__":
    main()
