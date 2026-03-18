"""Convert a GeoJSON file to GeoParquet."""

import argparse
import os
import sys

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "shapely": "shapely"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd


def convert(input_path: str, output_path: str, verbose: bool = False):
    """Convert a GeoJSON file to GeoParquet."""
    if verbose:
        print(f"Reading GeoJSON: {input_path}")

    gdf = gpd.read_file(input_path)
    gdf.columns = [c.lower() for c in gdf.columns]

    if verbose:
        print(f"  {len(gdf)} features, {len(gdf.columns)} columns")
        print(f"  CRS: {gdf.crs}")
        print(f"  Geometry type(s): {gdf.geometry.geom_type.unique().tolist()}")
        print(f"Writing GeoParquet: {output_path}")

    gdf.to_parquet(output_path)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a GeoJSON file to GeoParquet")
    parser.add_argument("--input", required=True, help="Path to input .geojson or .json file")
    parser.add_argument("--output", required=True, help="Path for output .parquet file")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".geojson", ".json"):
        print(f"Error: expected a .geojson or .json file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, verbose=args.verbose)


if __name__ == "__main__":
    main()
