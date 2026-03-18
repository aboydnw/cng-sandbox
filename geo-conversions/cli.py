"""Unified CLI for CNG Toolkit — auto-detects format and delegates."""

import argparse
import os
import sys

EXTENSION_MAP = {
    ".tif": "geotiff-to-cog",
    ".tiff": "geotiff-to-cog",
    ".shp": "shapefile-to-geoparquet",
    ".geojson": "geojson-to-geoparquet",
    ".json": "geojson-to-geoparquet",
    ".nc": "netcdf-to-cog",
    ".nc4": "netcdf-to-cog",
}

SUPPORTED_EXTENSIONS = ", ".join(sorted(set(EXTENSION_MAP.keys())))


def _load_skill(skill_name: str, script_name: str):
    """Dynamically load a script from a skill folder."""
    import importlib.util
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(script_dir, skill_name, "scripts", f"{script_name}.py")
    if not os.path.isfile(script_path):
        print(f"Error: {script_path} not found")
        sys.exit(1)
    spec = importlib.util.spec_from_file_location(script_name, script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def detect_format(input_path: str) -> str:
    """Detect the skill name from the input file extension."""
    ext = os.path.splitext(input_path)[1].lower()
    skill = EXTENSION_MAP.get(ext)
    if skill is None:
        print(f"Error: unsupported format '{ext}'")
        print(f"Supported: {SUPPORTED_EXTENSIONS}")
        sys.exit(1)
    return skill


def cmd_convert(args):
    """Run the appropriate converter."""
    skill = detect_format(args.input)
    mod = _load_skill(skill, "convert")

    kwargs = {"verbose": args.verbose}
    if skill == "netcdf-to-cog":
        if args.variable is not None:
            kwargs["variable"] = args.variable
        kwargs["time_index"] = args.time_index

    mod.convert(args.input, args.output, **kwargs)


def cmd_validate(args):
    """Run the appropriate validator."""
    ext = os.path.splitext(args.input)[1].lower()
    skill = EXTENSION_MAP.get(ext)
    if skill is None:
        print(f"Error: unsupported format '{ext}'")
        sys.exit(1)

    mod = _load_skill(skill, "validate")

    kwargs = {}
    if skill == "netcdf-to-cog":
        if args.variable is not None:
            kwargs["variable"] = args.variable
        kwargs["time_index"] = args.time_index

    results = mod.run_checks(args.input, args.output, **kwargs)
    passed = mod.print_report(results)
    sys.exit(0 if passed else 1)


def main():
    parser = argparse.ArgumentParser(description="CNG Toolkit — convert and validate geospatial files")
    sub = parser.add_subparsers(dest="command", required=True)

    p_convert = sub.add_parser("convert", help="Convert a geospatial file to cloud-native format")
    p_convert.add_argument("input", help="Path to input file")
    p_convert.add_argument("output", help="Path for output file")
    p_convert.add_argument("--variable", default=None, help="NetCDF variable name")
    p_convert.add_argument("--time-index", type=int, default=0, help="NetCDF timestep index")
    p_convert.add_argument("--verbose", action="store_true")
    p_convert.set_defaults(func=cmd_convert)

    p_validate = sub.add_parser("validate", help="Validate a converted file against its source")
    p_validate.add_argument("input", help="Path to original file")
    p_validate.add_argument("output", help="Path to converted file")
    p_validate.add_argument("--variable", default=None, help="NetCDF variable name")
    p_validate.add_argument("--time-index", type=int, default=0, help="NetCDF timestep index")
    p_validate.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
