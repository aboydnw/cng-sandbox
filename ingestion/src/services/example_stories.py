"""Startup task: seed a small set of example stories for every workspace.

Runs after `register_example_datasets` so the stories can reference the
example datasets by looking them up via their `source_url` metadata. The
task is idempotent — stories whose titles already exist as `is_example`
rows are skipped, and stories whose required datasets are not yet
registered are skipped (the next retry pass picks them up once the
dataset registers).
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow
from src.models.story import StoryRow

logger = logging.getLogger(__name__)

ChapterType = Literal["scrollytelling", "prose", "map"]

GEBCO_URL = "https://data.source.coop/alexgleith/gebco-2024/"
GHRSST_URL = "https://data.source.coop/ausantarctic/ghrsst-mur-v2/"
CARBON_URL = "https://data.source.coop/vizzuality/lg-land-carbon-data/"
BUILDINGS_URL = "https://data.source.coop/vida/google-microsoft-osm-open-buildings/"


@dataclass(frozen=True)
class ChapterSeed:
    type: ChapterType
    title: str
    narrative: str
    dataset_source_url: str | None = None
    center: tuple[float, float] = (0.0, 0.0)
    zoom: float = 2.0
    bearing: float = 0.0
    pitch: float = 0.0
    basemap: str = "streets"
    colormap: str = "viridis"
    opacity: float = 0.85
    rescale_min: float | None = None
    rescale_max: float | None = None
    timestep: int | None = None
    overlay_position: Literal["left", "right"] = "left"
    transition: Literal["fly-to", "instant"] = "fly-to"


@dataclass(frozen=True)
class StorySeed:
    title: str
    description: str
    chapters: list[ChapterSeed] = field(default_factory=list)


OCEAN_FLOOR_STORY = StorySeed(
    title="A tour of the ocean floor",
    description=(
        "Seven stops across the planet's most striking underwater terrain, "
        "drawn from the GEBCO 2024 global bathymetry model."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="Below the surface",
            narrative=(
                "More than two thirds of Earth is under water, and almost "
                "all of it is out of sight. **Bathymetry** — the topography "
                "of the seafloor — is mapped using sonar, satellite "
                "altimetry, and a growing global effort to chart every "
                "ocean basin.\n\n"
                "This story pulls from **GEBCO 2024**, a worldwide "
                "elevation model compiled by the General Bathymetric "
                "Chart of the Oceans. Scroll through five vantage points "
                "to see the geology that shapes our oceans, then open "
                "the free-explore map at the end to wander the seafloor "
                "yourself."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Mariana Trench",
            narrative=(
                "In the western Pacific, the Pacific Plate dives beneath "
                "the Philippine Sea Plate, carving the deepest known "
                "trench on Earth. The **Challenger Deep**, at roughly "
                "-10,935 m, sits below pressures forty times stronger "
                "than those at sea level.\n\n"
                "On this map the darkest ribbon running north-south is "
                "the trench itself — a place where the seafloor is "
                "farther from us, vertically, than Everest is tall."
            ),
            dataset_source_url=GEBCO_URL,
            center=(142.5, 11.5),
            zoom=5.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Mid-Atlantic Ridge",
            narrative=(
                "Down the spine of the Atlantic, two plates are pulling "
                "apart at roughly 2.5 cm per year. Where they separate, "
                "new ocean crust wells up and cools, building a **mid-"
                "ocean ridge** that runs almost pole to pole.\n\n"
                "Iceland is the one place the ridge rises above sea "
                "level. Everywhere else it's a long, faintly paler band "
                "on this map — the youngest rock on the seafloor, still "
                "being made."
            ),
            dataset_source_url=GEBCO_URL,
            center=(-30.0, 0.0),
            zoom=3.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Continental shelves",
            narrative=(
                "Off the east coast of North America, the land doesn't "
                "stop at the shoreline — it extends outward underwater "
                "for hundreds of kilometers before dropping off. This "
                "gently sloping apron is the **continental shelf**.\n\n"
                "Shelves are biologically rich (most of the world's "
                "fisheries sit on them) and geologically young. Look for "
                "the sharp color break where the shelf ends and the "
                "continental slope plunges toward the abyssal plain."
            ),
            dataset_source_url=GEBCO_URL,
            center=(-74.0, 36.0),
            zoom=4.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Abyssal plains",
            narrative=(
                "Between the trenches and the ridges, most of the ocean "
                "floor is flat — astonishingly flat. The **abyssal "
                "plains** are vast, sediment-blanketed expanses sitting "
                "around -4,000 to -6,000 m.\n\n"
                "The eastern South Pacific is one of the largest. At "
                "this zoom level, the uniform color is doing the "
                "storytelling: there's almost nothing down there but a "
                "very long, very level seabed."
            ),
            dataset_source_url=GEBCO_URL,
            center=(-130.0, -30.0),
            zoom=3.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="map",
            title="Explore the seafloor",
            narrative=(
                "Pan and zoom anywhere in the world. Look for ridges, "
                "fracture zones, seamount chains, and submarine canyons. "
                "The Hawaiian-Emperor chain, the Ninety East Ridge in "
                "the Indian Ocean, and the Zapiola Rise in the South "
                "Atlantic are all worth a visit."
            ),
            dataset_source_url=GEBCO_URL,
            center=(0.0, 0.0),
            zoom=2.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="prose",
            title="How this map was made",
            narrative=(
                "GEBCO 2024 is a global gridded bathymetry dataset "
                "assembled from ship soundings, satellite-derived "
                "gravity measurements, and regional compilations. It's "
                "freely distributed via [source.coop]"
                "(https://source.coop/alexgleith/gebco-2024) as cloud-"
                "optimized GeoTIFFs, which is what makes this zoom-"
                "anywhere map possible without downloading the whole "
                "file.\n\n"
                "To build your own story like this one, duplicate this "
                "template and edit the chapters."
            ),
        ),
    ],
)


CITIES_STORY = StorySeed(
    title="Cities from space",
    description=(
        "A six-chapter look at three of the world's largest cities "
        "through a global building-footprint dataset."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="A planet of buildings",
            narrative=(
                "How do you measure a city? Population counts shift, "
                "administrative borders lie, and satellite imagery can "
                "be hard to compare. One answer: count the buildings.\n\n"
                "This story uses the **VIDA global buildings** layer — "
                "a single open dataset that merges Google's Open "
                "Buildings, Microsoft's Global ML Building Footprints, "
                "and OpenStreetMap into one worldwide vector map."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Tokyo",
            narrative=(
                "Tokyo's metropolitan area holds around 37 million "
                "people. On this map, the city's footprints form a "
                "continuous fabric stretching from Yokohama in the "
                "south through the 23 special wards and out to the "
                "Saitama and Chiba suburbs.\n\n"
                "Notice how the building density tracks the flat "
                "Kanto plain and thins abruptly where the terrain "
                "rises."
            ),
            dataset_source_url=BUILDINGS_URL,
            center=(139.6917, 35.6895),
            zoom=11.0,
            opacity=0.85,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Lagos",
            narrative=(
                "Lagos is one of the world's fastest-growing cities and "
                "the economic engine of West Africa. Its building "
                "pattern is unmistakable: a lagoon-spanning core on "
                "Lagos and Victoria Islands, and an immense, dense "
                "mainland sprawling north and west.\n\n"
                "Much of that mainland fabric was invisible to older "
                "global datasets — it only appears here because machine-"
                "learning-detected footprints from satellite imagery "
                "were merged with OpenStreetMap."
            ),
            dataset_source_url=BUILDINGS_URL,
            center=(3.3792, 6.5244),
            zoom=11.0,
            opacity=0.85,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="São Paulo",
            narrative=(
                "São Paulo's built area covers the whole basin it sits "
                "in and spills out into neighboring municipalities. "
                "From above, the most distinctive feature is the "
                "texture change between the colonial-era center and "
                "the peripheral informal neighborhoods, which appear "
                "as finer-grained building clusters on steep hills.\n\n"
                "Zoom in and the data resolution is good enough to "
                "pick out individual blocks."
            ),
            dataset_source_url=BUILDINGS_URL,
            center=(-46.6333, -23.5505),
            zoom=11.0,
            opacity=0.85,
        ),
        ChapterSeed(
            type="map",
            title="Explore worldwide",
            narrative=(
                "This is a global dataset — every continent except "
                "Antarctica has coverage. Pan anywhere and zoom in to "
                "compare city fabrics. A few suggestions: Cairo's Nile "
                "delta, Jakarta's coastal sprawl, Mexico City's "
                "altiplano, Seoul's river-split core."
            ),
            dataset_source_url=BUILDINGS_URL,
            center=(0.0, 20.0),
            zoom=2.0,
            opacity=0.85,
        ),
        ChapterSeed(
            type="prose",
            title="One dataset, three authors",
            narrative=(
                "The underlying archive — roughly 2.7 billion "
                "footprints — was assembled by **VIDA** from three "
                "sources: Google Open Buildings, Microsoft Global ML "
                "Building Footprints, and OpenStreetMap. It's served "
                "as a single PMTiles archive on source.coop, which is "
                "why you can pan this map worldwide without any "
                "server-side tile pipeline.\n\n"
                "Attribution: © VIDA, Google, Microsoft, and "
                "OpenStreetMap contributors."
            ),
        ),
    ],
)


OCEAN_FOREST_STORY = StorySeed(
    title="A warming ocean, a shrinking forest",
    description=(
        "Eight chapters linking sea surface temperature and tropical "
        "deforestation — two of the clearest signals of a changing "
        "planet."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="Two views of a changing planet",
            narrative=(
                "The clearest fingerprints of a warming climate show "
                "up in two places: the **ocean**, which absorbs more "
                "than 90% of the extra heat humans have added to the "
                "atmosphere, and the **tropical forests**, whose "
                "burning and clearing is one of the largest "
                "continuing sources of that extra heat.\n\n"
                "This story alternates between them. Scroll through "
                "sea surface temperature and then deforestation-driven "
                "carbon emissions, and end with a free-explore map of "
                "the emissions layer."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The global ocean, one day at a time",
            narrative=(
                "**GHRSST MUR v2** is a daily, 1-km sea surface "
                "temperature analysis — a blended product from "
                "satellite and in-situ observations that gives a full "
                "global picture of ocean surface temperatures every "
                "24 hours.\n\n"
                "At this zoom you can already see the basic structure: "
                "warm equatorial belts, cool polar seas, and the "
                "western boundary currents (Gulf Stream, Kuroshio) "
                "pumping heat poleward on the western side of each "
                "ocean basin."
            ),
            dataset_source_url=GHRSST_URL,
            center=(0.0, 10.0),
            zoom=2.0,
            colormap="turbo",
            opacity=0.85,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The tropical Pacific",
            narrative=(
                "The equatorial Pacific is the planet's climate "
                "metronome. The east-west gradient in surface "
                "temperature across this basin drives the Walker "
                "circulation, and when that gradient weakens or "
                "flips, the result is an **El Niño** event with "
                "global consequences.\n\n"
                "Look for the tongue of cooler water extending west "
                "from the South American coast — that's the "
                "upwelling the Walker circulation depends on."
            ),
            dataset_source_url=GHRSST_URL,
            center=(-150.0, 0.0),
            zoom=3.0,
            colormap="turbo",
            opacity=0.85,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Gulf Stream",
            narrative=(
                "Off the US East Coast, the Gulf Stream pulls warm "
                "tropical water north along the continental shelf "
                "edge and out into the North Atlantic. It's the "
                "sharpest sea-surface-temperature front on Earth.\n\n"
                "At this scale the contrast is unmistakable: warm, "
                "saturated colors south of the front; cool, muted "
                "colors north of it. Small-scale eddies spin off on "
                "both sides."
            ),
            dataset_source_url=GHRSST_URL,
            center=(-68.0, 38.0),
            zoom=4.0,
            colormap="turbo",
            opacity=0.85,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Amazon frontier",
            narrative=(
                "Now switch to land. This layer shows **gross carbon "
                "emissions from deforestation** at 100 m resolution, "
                "compiled by the WRI Land & Carbon Lab from Hansen "
                "tree-cover loss and IPCC emission factors.\n\n"
                "The southern arc of the Brazilian Amazon — Rondônia, "
                "Mato Grosso, southern Pará — has been the most "
                "active deforestation frontier on Earth for the past "
                "two decades. Hotter reds mean more carbon released "
                "per hectare."
            ),
            dataset_source_url=CARBON_URL,
            center=(-60.0, -8.0),
            zoom=5.0,
            colormap="reds",
            opacity=0.9,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Congo Basin",
            narrative=(
                "The Congo Basin holds the world's second largest "
                "expanse of tropical rainforest and has historically "
                "had much lower deforestation rates than the Amazon. "
                "That pattern is shifting.\n\n"
                "Smallholder agriculture, charcoal production, and "
                "new road networks are opening parts of the basin "
                "that were previously intact. The red pixels mark "
                "where that's already happened."
            ),
            dataset_source_url=CARBON_URL,
            center=(22.0, -1.0),
            zoom=5.0,
            colormap="reds",
            opacity=0.9,
        ),
        ChapterSeed(
            type="map",
            title="Explore carbon emissions",
            narrative=(
                "This is the same emissions layer, globally. Try "
                "Indonesia and Malaysia (palm oil), the Gran Chaco "
                "in South America (soy and cattle), or the "
                "Mekong-Ganges lowlands (rice and smallholder "
                "clearing)."
            ),
            dataset_source_url=CARBON_URL,
            center=(0.0, 0.0),
            zoom=2.0,
            colormap="reds",
            opacity=0.9,
        ),
        ChapterSeed(
            type="prose",
            title="What you can do next",
            narrative=(
                "Everything in this story is built from open data and "
                "tools. You can:\n\n"
                "- Duplicate this template and rewrite it with your "
                "own focus — a single basin, a single year, a single "
                "event.\n"
                "- Upload your own GeoTIFF, NetCDF, GeoJSON, or "
                "Shapefile to add local data on top of these global "
                "layers.\n"
                "- Connect an external tile source (XYZ, PMTiles, "
                "COG, or GeoParquet) and pull it into a story.\n\n"
                "Start from the home page's *Start from scratch* "
                "button, or fork this story to reuse the map states."
            ),
        ),
    ],
)


ALL_STORIES: list[StorySeed] = [
    OCEAN_FLOOR_STORY,
    CITIES_STORY,
    OCEAN_FOREST_STORY,
]


def _load_example_dataset_map(
    db_session_factory: sessionmaker,
) -> dict[str, str]:
    """Return {source_url: dataset_id} for rows tagged is_example=True."""
    session = db_session_factory()
    try:
        rows = session.query(DatasetRow).filter(DatasetRow.is_example.is_(True)).all()
        mapping: dict[str, str] = {}
        for row in rows:
            meta = json.loads(row.metadata_json) if row.metadata_json else {}
            url = meta.get("source_url")
            if url:
                mapping[url] = row.id
        return mapping
    finally:
        session.close()


def _existing_example_story_titles(
    db_session_factory: sessionmaker,
) -> set[str]:
    session = db_session_factory()
    try:
        rows = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        return {r.title for r in rows}
    finally:
        session.close()


def _build_chapter_dict(
    ch: ChapterSeed,
    order: int,
    dataset_id: str | None,
) -> dict:
    layer_config: dict | None = None
    if ch.type != "prose" and dataset_id:
        layer_config = {
            "dataset_id": dataset_id,
            "colormap": ch.colormap,
            "opacity": ch.opacity,
            "basemap": ch.basemap,
        }
        if ch.rescale_min is not None:
            layer_config["rescale_min"] = ch.rescale_min
        if ch.rescale_max is not None:
            layer_config["rescale_max"] = ch.rescale_max
        if ch.timestep is not None:
            layer_config["timestep"] = ch.timestep

    return {
        "id": str(uuid.uuid4()),
        "order": order,
        "type": ch.type,
        "title": ch.title,
        "narrative": ch.narrative,
        "map_state": {
            "center": [ch.center[0], ch.center[1]],
            "zoom": ch.zoom,
            "bearing": ch.bearing,
            "pitch": ch.pitch,
            "basemap": ch.basemap,
        },
        "transition": ch.transition,
        "overlay_position": ch.overlay_position,
        "layer_config": layer_config,
    }


def seed_example_stories(db_session_factory: sessionmaker) -> None:
    """Insert any example stories whose datasets are registered and whose
    titles are not already present.

    Idempotent within a single process and safe under concurrent startups:
    a partial unique index on `(title) WHERE is_example = TRUE` (see
    `_migrate_schema`) prevents duplicate example rows, and
    `IntegrityError` is caught per-story so a racing insert is treated as
    a no-op.
    """
    dataset_map = _load_example_dataset_map(db_session_factory)
    existing_titles = _existing_example_story_titles(db_session_factory)

    for story in ALL_STORIES:
        if story.title in existing_titles:
            logger.debug("example story already present: %s", story.title)
            continue

        required_urls = {
            ch.dataset_source_url for ch in story.chapters if ch.dataset_source_url
        }
        missing = required_urls - dataset_map.keys()
        if missing:
            logger.warning(
                "skipping example story %r — datasets not yet registered: %s",
                story.title,
                sorted(missing),
            )
            continue

        chapters_json = [
            _build_chapter_dict(
                ch,
                order=idx,
                dataset_id=(
                    dataset_map.get(ch.dataset_source_url)
                    if ch.dataset_source_url
                    else None
                ),
            )
            for idx, ch in enumerate(story.chapters)
        ]

        primary_dataset_id = next(
            (
                dataset_map[ch.dataset_source_url]
                for ch in story.chapters
                if ch.dataset_source_url
            ),
            None,
        )

        now = datetime.now(UTC)
        session = db_session_factory()
        try:
            session.add(
                StoryRow(
                    id=str(uuid.uuid4()),
                    title=story.title,
                    description=story.description,
                    dataset_id=primary_dataset_id,
                    chapters_json=json.dumps(chapters_json),
                    published=True,
                    is_example=True,
                    workspace_id=None,
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()
            logger.info("seeded example story: %s", story.title)
        except IntegrityError:
            session.rollback()
            logger.info(
                "example story %r already inserted by a concurrent process",
                story.title,
            )
        finally:
            session.close()
