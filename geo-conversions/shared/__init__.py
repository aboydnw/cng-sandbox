"""Shared utilities for geo-conversion skills."""

import importlib.util
import os

_SCRIPTS = os.path.join(os.path.dirname(__file__), "scripts")
_cache = {}


def _load(name):
    if name not in _cache:
        spec = importlib.util.spec_from_file_location(name, os.path.join(_SCRIPTS, f"{name}.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _cache[name] = mod
    return _cache[name]


def reproject_to_cog(input_tif: str, output_path: str, **kwargs):
    """Reproject a GeoTIFF to EPSG:4326 and write as a COG."""
    return _load("reproject").reproject_to_cog(input_tif, output_path, **kwargs)
