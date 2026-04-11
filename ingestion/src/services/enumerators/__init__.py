"""Enumerators turn a source.coop product reference into a list of RemoteItems.

Each enumerator is a strategy function: given product-specific args, it returns
a list of RemoteItem describing the files in the product along with any
available spatial and temporal metadata. The registration pipeline consumes
this list and writes items into pgSTAC.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class RemoteItem:
    """One file in a source.coop product, ready to register as a STAC item.

    Attributes:
        href: HTTPS URL of the file, typically under data.source.coop.
        datetime: Datetime for temporal datasets, None for single-frame.
        bbox: [west, south, east, north] in EPSG:4326, or None if unknown.
            When None, callers must probe the COG to get bounds before
            registering a pgSTAC item.
    """

    href: str
    datetime: datetime | None
    bbox: list[float] | None
