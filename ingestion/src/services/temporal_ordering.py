"""Extract timestamps from filenames and sort files in temporal order."""

import os
import re
from dataclasses import dataclass


@dataclass
class OrderedFile:
    filename: str
    datetime: str  # ISO 8601 UTC
    index: int


# Patterns ordered most-specific to least-specific
_PATTERNS = [
    # YYYY-MM-DD or YYYYMMDD
    (
        re.compile(r"(\d{4})-(\d{2})-(\d{2})"),
        lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z",
    ),
    (
        re.compile(r"(\d{4})(\d{2})(\d{2})(?!\d)"),
        lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z",
    ),
    # YYYY_MM_DD
    (
        re.compile(r"(\d{4})_(\d{2})_(\d{2})"),
        lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z",
    ),
    # YYYY-MM
    (
        re.compile(r"(\d{4})-(\d{2})(?!\d)"),
        lambda m: f"{m.group(1)}-{m.group(2)}-01T00:00:00Z",
    ),
    # YYYY (must not be followed by more digits)
    (re.compile(r"(?<!\d)(\d{4})(?!\d)"), lambda m: f"{m.group(1)}-01-01T00:00:00Z"),
]


def extract_timestamp_from_filename(filename: str) -> str | None:
    """Extract an ISO 8601 UTC timestamp from a filename's date pattern, or None if not found."""
    stem = os.path.splitext(os.path.basename(filename))[0]
    for pattern, formatter in _PATTERNS:
        match = pattern.search(stem)
        if match:
            return formatter(match)
    return None


def order_files(filenames: list[str]) -> list[OrderedFile]:
    """Sort files by extracted timestamp, falling back to alphabetical order."""
    pairs = [(f, extract_timestamp_from_filename(f)) for f in filenames]
    has_timestamps = any(dt is not None for _, dt in pairs)

    if has_timestamps:
        # Sort by extracted datetime, then filename for ties
        pairs.sort(key=lambda p: (p[1] or "9999", p[0]))
    else:
        # Alphabetical fallback
        pairs.sort(key=lambda p: p[0])

    result = []
    for i, (filename, dt) in enumerate(pairs):
        if dt is None:
            # Assign monotonic placeholder datetime for files without temporal signal
            dt = f"1970-01-{i + 1:02d}T00:00:00Z"
        result.append(OrderedFile(filename=filename, datetime=dt, index=i))
    return result


def common_filename_prefix(filenames: list[str]) -> str:
    """Return the common prefix of filename stems, or the first stem if no common prefix."""
    if not filenames:
        return ""
    if len(filenames) == 1:
        return os.path.splitext(os.path.basename(filenames[0]))[0]

    stems = [os.path.splitext(os.path.basename(f))[0] for f in filenames]
    prefix = re.sub(r"[\d_\- ]+$", "", os.path.commonprefix(stems))
    if not prefix:
        return os.path.splitext(os.path.basename(filenames[0]))[0]
    return prefix
