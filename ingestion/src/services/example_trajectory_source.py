"""Canonical source + attribution for the example white-stork trajectory.

Kept in one place so the dataset seeder, the story seeder, tests, and docs all
share a single source-of-truth string. The `example_dataset_id` derived from
`STORK_SOURCE_URL` is the deterministic id under which the pre-built
`trips.json` + GeoParquet artifacts live in R2.
"""

from __future__ import annotations

STORK_SOURCE_URL = "https://doi.org/10.5441/001/1.271"

STORK_TITLE = "White stork migration"

STORK_ATTRIBUTION = (
    "Data from Bontekoe ID, Flack A, Fiedler W (2023): 'The price of being "
    "late: short- and long-term consequences of a delayed migration timing' "
    "(LifeTrack White Stork SW Germany), via the Movebank Data Repository "
    "(doi:10.5441/001/1.271), released under CC0 1.0."
)
