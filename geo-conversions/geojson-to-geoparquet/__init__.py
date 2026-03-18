"""GeoJSON to GeoParquet conversion skill."""

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


def convert(input_path: str, output_path: str, **kwargs):
    """Convert a GeoJSON file to GeoParquet."""
    return _load("convert").convert(input_path, output_path, **kwargs)


def run_checks(input_path: str, output_path: str, **kwargs):
    """Run all validation checks and return list[CheckResult]."""
    return _load("validate").run_checks(input_path, output_path, **kwargs)
