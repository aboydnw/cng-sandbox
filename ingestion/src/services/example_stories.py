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

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow

logger = logging.getLogger(__name__)

ChapterType = Literal["scrollytelling", "prose", "map", "flyover"]

GEBCO_URL = "https://data.source.coop/alexgleith/gebco-2024/"
GHRSST_URL = "https://data.source.coop/ausantarctic/ghrsst-mur-v2/"
CARBON_URL = "https://data.source.coop/vizzuality/lg-land-carbon-data/"
BUILDINGS_URL = "https://data.source.coop/vida/google-microsoft-osm-open-buildings/"
LAHAINA_URL = "https://maxar-opendata.s3.amazonaws.com/events/Maui-Hawaii-fires-Aug-23/collection.json"
HATAY_FLIGHT1_URL = "https://oin-hotosm-temp.s3.amazonaws.com/63f21def525f0700077ed4e2/0/63f21def525f0700077ed4e3.tif"
HATAY_DEFNE_URL = "https://oin-hotosm-temp.s3.amazonaws.com/63eb7815ca43600005f4d91e/0/63eb7815ca43600005f4d91f.tif"
HATAY_TURINCLU_URL = "https://oin-hotosm-temp.s3.amazonaws.com/63eb8222ca43600005f4d925/0/63eb8222ca43600005f4d926.tif"


@dataclass(frozen=True)
class OverlaySeed:
    connection_url: str
    connection_type: str
    opacity: float = 1.0
    stroke_color: str | None = None
    stroke_width: float | None = None
    fill_color: str | None = None
    fill_opacity: float | None = None
    visible: bool = True


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
    terrain: dict | None = None
    globe: bool = False
    buildings: bool = False
    keyframes: tuple[dict, ...] | None = None
    scroll_length: float = 1.0
    connection_url: str | None = None
    connection_type: str | None = None
    color_mode: str | None = None
    point_size: float | None = None
    colormap_reversed: bool | None = None
    overlays: tuple[OverlaySeed, ...] = ()


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
            title="One connected ocean",
            narrative=(
                "Seen whole, the ocean is a single body of water wrapping "
                "the planet — Pacific running into Southern into Atlantic "
                "with no real edges.\n\n"
                "Spin the globe to get your bearings, then we'll drop down "
                "into five specific places on the seafloor."
            ),
            center=(-150.0, 5.0),
            zoom=1.6,
            globe=True,
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
            type="scrollytelling",
            title="Where the seafloor meets land",
            narrative=(
                "Relief doesn't stop at the waterline. Tilt the view over "
                "the Andean coast and the ground climbs steeply out of the "
                "Pacific — the same abyssal trench, now met by mountains.\n\n"
                "This is a scene-setting stop: no data overlay, just the "
                "shape of the terrain, exaggerated to read clearly."
            ),
            center=(-70.5, -33.0),
            zoom=6.0,
            pitch=60.0,
            terrain={"enabled": True, "exaggeration": 1.5},
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


LAHAINA_STORY = StorySeed(
    title="Anatomy of the Lahaina burn scar",
    description=(
        "High-resolution true-color satellite imagery of Lahaina, Maui, in the "
        "days after the August 2023 wildfire — one of the deadliest in modern "
        "U.S. history. Imagery © Maxar/Vantor Open Data (CC-BY-NC 4.0)."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="A town on the water",
            narrative=(
                "On **August 8, 2023**, a wind-driven wildfire swept through "
                "Lahaina on the west coast of Maui. Within days, satellites "
                "captured the aftermath in **high-resolution true-color "
                "imagery** through the Maxar/Vantor Open Data Program.\n\n"
                "Scroll to fly across the burn scar, then open the map at the "
                "end to explore it yourself."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The burn scar from above",
            narrative=(
                "A wide view of Lahaina after the fire. Entire blocks are "
                "reduced to ash while the surrounding vegetation and coastline "
                "remain — the sharp boundary of the burn scar is visible from "
                "orbit."
            ),
            dataset_source_url=LAHAINA_URL,
            center=(-156.68, 20.88),
            zoom=14.5,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="left",
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The waterfront, block by block",
            narrative=(
                "Zooming in on Front Street and the harbor. At this scale the "
                "imagery resolves individual lots — you can trace which "
                "structures stood and which were lost along the shoreline."
            ),
            dataset_source_url=LAHAINA_URL,
            center=(-156.6792, 20.8722),
            zoom=16.0,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="right",
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Where the fire stopped",
            narrative=(
                "At the edges of the scar, the transition is abrupt: charred "
                "parcels sit directly beside untouched greenery. The imagery "
                "maps exactly where the fire's advance halted."
            ),
            dataset_source_url=LAHAINA_URL,
            center=(-156.6845, 20.8901),
            zoom=15.5,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="left",
        ),
        ChapterSeed(
            type="prose",
            title="Why aerial imagery matters",
            narrative=(
                "True-color imagery like this is among the first data available "
                "after a disaster. It guides search-and-rescue, scopes the "
                "damage for recovery funding, and creates a permanent record of "
                "the event.\n\n"
                "Imagery © Maxar/Vantor Open Data, released under CC-BY-NC 4.0."
            ),
        ),
        ChapterSeed(
            type="map",
            title="Explore the burn scar",
            narrative=(
                "Pan and zoom across the post-fire imagery. The contrast "
                "between burned and unburned parcels maps the fire's path "
                "block by block."
            ),
            dataset_source_url=LAHAINA_URL,
            center=(-156.68, 20.88),
            zoom=14.0,
            basemap="streets",
            opacity=1.0,
        ),
    ],
)


ANTAKYA_STORY = StorySeed(
    title="Antakya from above: a city after the earthquake",
    description=(
        "Drone aerial imagery of Antakya (Hatay), Turkey, captured days after "
        "the February 2023 earthquake — detail no satellite can resolve. "
        "Imagery © OpenAerialMap contributors (CC-BY 4.0)."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="When the ground moved",
            narrative=(
                "On **February 6, 2023**, a magnitude 7.8 earthquake struck "
                "southern Turkey and northern Syria. In the days that "
                "followed, drones flew over Antakya and mapped the damage at "
                "**centimeter resolution** — far sharper than any satellite.\n\n"
                "Scroll to fly across the city, then open the map at the end "
                "to explore it yourself."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="A district in ruins",
            narrative=(
                "A wide view over one Antakya district. Even at this zoom, "
                "the pattern of collapse is unmistakable — standing blocks "
                "beside heaps of rubble."
            ),
            dataset_source_url=HATAY_FLIGHT1_URL,
            center=(36.199, 36.229),
            zoom=16.0,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="left",
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Elektrik Mahallesi, building by building",
            narrative=(
                "At ~3 cm resolution in Defne's Elektrik neighborhood, the "
                "imagery resolves individual structures — pancaked floors, "
                "debris fields, and the narrow lanes rescue crews had to "
                "clear."
            ),
            dataset_source_url=HATAY_DEFNE_URL,
            center=(36.149, 36.198),
            zoom=18.0,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="right",
        ),
        ChapterSeed(
            type="scrollytelling",
            title="Akdeniz and Armutlu",
            narrative=(
                "A second neighborhood at the same fidelity. Cleared lots and "
                "staging areas mark where response was already underway when "
                "the drone flew."
            ),
            dataset_source_url=HATAY_TURINCLU_URL,
            center=(36.147, 36.194),
            zoom=18.0,
            basemap="streets",
            opacity=1.0,
            transition="fly-to",
            overlay_position="left",
        ),
        ChapterSeed(
            type="prose",
            title="What aerial sees that satellites can't",
            narrative=(
                "At a few centimeters per pixel, low-altitude aerial imagery "
                "shows what satellites smear together: which floor failed, "
                "where a façade fell, whether a lane is passable. That detail "
                "drives search-and-rescue routing and damage assessment in "
                "the first hours after a disaster.\n\n"
                "Imagery © OpenAerialMap contributors, released under CC-BY 4.0."
            ),
        ),
        ChapterSeed(
            type="map",
            title="Explore the imagery",
            narrative=(
                "Pan and zoom across the district. Zoom all the way in — the "
                "imagery holds detail well past where satellite would blur."
            ),
            dataset_source_url=HATAY_FLIGHT1_URL,
            center=(36.199, 36.229),
            zoom=15.0,
            basemap="streets",
            opacity=1.0,
        ),
    ],
)


HIGH_PLACES_STORY = StorySeed(
    title="Earth's high places",
    description=(
        "A 3D tour of the planet's great mountains — spin the globe, tilt into "
        "exaggerated terrain over the Himalaya and the Andes, rise through a city "
        "built into the peaks, then explore global relief. Try the **Ask this "
        "map** button to fly between the stops. Built on open elevation data."
    ),
    chapters=[
        ChapterSeed(
            type="prose",
            title="The high places",
            narrative=(
                "Mountains are the hardest part of the planet to picture from a "
                "flat map. Height is the whole story, and a top-down view throws "
                "it away.\n\n"
                "This story leans on the map's **3D scene** instead — a globe, "
                "exaggerated terrain, and extruded buildings — to put the "
                "vertical back in. Scroll through five stops from orbit down to "
                "street level, then open the free-explore map at the end.\n\n"
                "There's also an **Ask this map** button. Ask it to fly to the "
                "Andes, jump to a chapter, or explain what a stop is showing — "
                "it drives the map for you."
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="One planet, seen whole",
            narrative=(
                "Start from orbit. On the globe the great mountain belts read as "
                "seams across the continents — the Himalaya arcing along southern "
                "Asia, the Andes running the length of South America.\n\n"
                "These are the collision zones, where plates push into each other "
                "and the crust has nowhere to go but up. We'll drop into two of "
                "them."
            ),
            center=(80.0, 20.0),
            zoom=1.7,
            globe=True,
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Himalaya",
            narrative=(
                "Where the Indian plate drives into Asia, the ground has buckled "
                "into the highest range on Earth — fourteen peaks above 8,000 m, "
                "**Everest** the tallest of them.\n\n"
                "Tilt into the terrain and the relief is exaggerated so the "
                "ridges and valleys read clearly. This is a scene-setting stop: "
                "no data overlay, just the shape of the land."
            ),
            center=(86.925, 27.988),
            zoom=9.0,
            pitch=68.0,
            bearing=20.0,
            terrain={"enabled": True, "exaggeration": 1.5},
        ),
        ChapterSeed(
            type="flyover",
            title="Around the roof of the world",
            narrative=(
                "Now let the camera do the climbing. As you scroll, the view "
                "sweeps half an orbit around **Everest** — the summit pyramid, "
                "the Western Cwm, and the long ridgelines trading places as "
                "the bearing turns.\n\n"
                "Scroll slowly and the ridges rotate; scroll fast and the "
                "camera catches up smoothly behind you."
            ),
            center=(86.925, 27.988),
            zoom=11.0,
            pitch=62.0,
            bearing=-40.0,
            terrain={"enabled": True, "exaggeration": 1.5},
            keyframes=(
                {
                    "center": [86.925, 27.988],
                    "zoom": 11.0,
                    "bearing": -40.0,
                    "pitch": 62.0,
                    "caption": (
                        "Everest from the southwest — the summit pyramid dead ahead."
                    ),
                },
                {
                    "center": [86.93, 27.99],
                    "zoom": 11.2,
                    "bearing": 5.0,
                    "pitch": 62.0,
                },
                {
                    "center": [86.935, 27.992],
                    "zoom": 11.4,
                    "bearing": 50.0,
                    "pitch": 60.0,
                    "caption": (
                        "Turning east over the Khumbu — Lhotse and Nuptse "
                        "swing into view."
                    ),
                },
                {
                    "center": [86.93, 27.99],
                    "zoom": 11.2,
                    "bearing": 95.0,
                    "pitch": 60.0,
                },
                {
                    "center": [86.925, 27.988],
                    "zoom": 11.0,
                    "bearing": 140.0,
                    "pitch": 62.0,
                    "caption": (
                        "Half an orbit later: the same mountain, a different mountain."
                    ),
                },
            ),
        ),
        ChapterSeed(
            type="scrollytelling",
            title="The Andes",
            narrative=(
                "On the other side of the planet, the Andes run more than "
                "7,000 km down the western edge of South America — the longest "
                "continental mountain range there is, thrown up where the Nazca "
                "plate dives under the continent.\n\n"
                "Near the Argentina-Chile border sits **Aconcagua**, at 6,961 m "
                "the highest peak outside Asia. Tilt across the spine and watch "
                "the terrain climb straight out of the lowlands."
            ),
            center=(-70.011, -32.653),
            zoom=8.5,
            pitch=66.0,
            bearing=-25.0,
            terrain={"enabled": True, "exaggeration": 1.5},
        ),
        ChapterSeed(
            type="scrollytelling",
            title="A city in the mountains",
            narrative=(
                "People live in these ranges too. **Kathmandu** sits in a "
                "bowl-shaped valley at about 1,400 m, ringed by Himalayan "
                "foothills.\n\n"
                "Drop to street level and the buildings rise in 3D — extruded "
                "from open building-footprint data. It's a different kind of "
                "terrain: the built one."
            ),
            center=(85.324, 27.7172),
            zoom=15.5,
            pitch=55.0,
            bearing=20.0,
            buildings=True,
        ),
        ChapterSeed(
            type="map",
            title="Explore the world's relief",
            narrative=(
                "Now the whole planet's elevation, from the **GEBCO 2024** global "
                "model. Pan and zoom anywhere: trace the Rockies, the Alps, the "
                "East African Rift, or the deep ocean trenches on the other end "
                "of the scale.\n\n"
                "Ask the map to take you somewhere, or toggle the relief layer "
                "on and off to compare it with the basemap."
            ),
            dataset_source_url=GEBCO_URL,
            center=(30.0, 25.0),
            zoom=2.0,
            colormap="terrain",
            opacity=0.9,
        ),
        ChapterSeed(
            type="prose",
            title="Built from open data",
            narrative=(
                "Every layer here is open. Terrain relief comes from the "
                "**Mapterhorn** global DEM, the 3D buildings from **OpenFreeMap** "
                "vector tiles, and the elevation model from **GEBCO 2024**, "
                "distributed as cloud-optimized GeoTIFFs via [source.coop]"
                "(https://source.coop/alexgleith/gebco-2024).\n\n"
                "Fork this story to reuse its 3D map states, or start from "
                "scratch and add your own data on top. And keep using **Ask this "
                "map** — it can navigate any published story like this one."
            ),
        ),
    ],
)


ALL_STORIES: list[StorySeed] = [
    OCEAN_FLOOR_STORY,
    CITIES_STORY,
    OCEAN_FOREST_STORY,
    LAHAINA_STORY,
    ANTAKYA_STORY,
    HIGH_PLACES_STORY,
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


def _load_example_connection_map(
    db_session_factory: sessionmaker,
) -> dict[tuple[str, str], str]:
    """Return {(url, connection_type): connection_id} for is_example=True rows."""
    session = db_session_factory()
    try:
        rows = (
            session.query(ConnectionRow)
            .filter(ConnectionRow.is_example.is_(True))
            .all()
        )
        return {(r.url, r.connection_type): r.id for r in rows}
    finally:
        session.close()


def _existing_example_story_rows_by_title(
    db_session_factory: sessionmaker,
) -> dict[str, str]:
    """Return ``{title: story_id}`` for every ``is_example=True`` story."""
    session = db_session_factory()
    try:
        rows = session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        return {r.title: r.id for r in rows}
    finally:
        session.close()


def _build_chapter_dict(
    ch: ChapterSeed,
    order: int,
    dataset_id: str | None,
    connection_id: str | None = None,
    connection_map: dict[tuple[str, str], str] | None = None,
) -> dict:
    if ch.type == "flyover":
        return {
            "id": str(uuid.uuid4()),
            "order": order,
            "type": "flyover",
            "title": ch.title,
            "narrative": ch.narrative,
            "keyframes": [dict(k) for k in ch.keyframes or ()],
            "scroll_length": ch.scroll_length,
            "map_state": {
                "center": [ch.center[0], ch.center[1]],
                "zoom": ch.zoom,
                "bearing": ch.bearing,
                "pitch": ch.pitch,
                "basemap": ch.basemap,
                **({"terrain": ch.terrain} if ch.terrain else {}),
                **({"globe": True} if ch.globe else {}),
                **({"buildings": True} if ch.buildings else {}),
            },
        }

    layer_config: dict | None = None
    if ch.type != "prose" and (dataset_id or connection_id):
        layer_config = {
            "dataset_id": dataset_id or "",
            "colormap": ch.colormap,
            "opacity": ch.opacity,
            "basemap": ch.basemap,
        }
        if connection_id:
            layer_config["connection_id"] = connection_id
        if ch.rescale_min is not None:
            layer_config["rescale_min"] = ch.rescale_min
        if ch.rescale_max is not None:
            layer_config["rescale_max"] = ch.rescale_max
        if ch.timestep is not None:
            layer_config["timestep"] = ch.timestep
        if ch.color_mode is not None:
            layer_config["color_mode"] = ch.color_mode
        if ch.point_size is not None:
            layer_config["point_size"] = ch.point_size
        if ch.colormap_reversed is not None:
            layer_config["colormap_reversed"] = ch.colormap_reversed

    overlays: list[dict] = []
    if ch.type != "prose" and ch.overlays:
        cmap = connection_map or {}
        for o in ch.overlays:
            overlays.append(
                {
                    "connection_id": cmap[(o.connection_url, o.connection_type)],
                    "opacity": o.opacity,
                    "visible": o.visible,
                    **({"stroke_color": o.stroke_color} if o.stroke_color else {}),
                    **(
                        {"stroke_width": o.stroke_width}
                        if o.stroke_width is not None
                        else {}
                    ),
                    **({"fill_color": o.fill_color} if o.fill_color else {}),
                    **(
                        {"fill_opacity": o.fill_opacity}
                        if o.fill_opacity is not None
                        else {}
                    ),
                }
            )

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
            **({"terrain": ch.terrain} if ch.terrain else {}),
            **({"globe": True} if ch.globe else {}),
            **({"buildings": True} if ch.buildings else {}),
        },
        "transition": ch.transition,
        "overlay_position": ch.overlay_position,
        "layer_config": layer_config,
        **({"overlays": overlays} if overlays else {}),
    }


def relink_dead_chapter_dataset_ids(db_session_factory: sessionmaker) -> int:
    """Rewrite chapter ``layer_config.dataset_id`` entries that point at
    datasets which no longer exist, using the seed catalog as the source
    of truth.

    Targets example stories and explicit forks of example stories (rows
    with ``forked_from_id`` set). User-authored stories are skipped even
    if their title happens to coincide with a seed, so a coincidental
    name collision cannot rewrite chapters the user wrote themselves. A
    chapter is a candidate for rewrite only when its current
    ``dataset_id`` does not resolve in the ``datasets`` table — live
    references are left untouched.

    The seed lookup is title-based: for an example story we match its
    title to a ``StorySeed``; for a fork we match the parent's title via
    ``forked_from_id``, falling back to the fork's own title (which is a
    copy of the parent's at fork time). If the existing chapter count
    differs from the seed (because the user added or removed chapters),
    we skip the row to avoid misaligning position-based replacements.

    Returns the number of stories with at least one chapter rewritten.
    """
    seed_by_title = {s.title: s for s in ALL_STORIES}
    dataset_map = _load_example_dataset_map(db_session_factory)
    connection_map = _load_example_connection_map(db_session_factory)

    session = db_session_factory()
    try:
        existing_dataset_ids = {r.id for r in session.query(DatasetRow).all()}
        existing_connection_ids = {r.id for r in session.query(ConnectionRow).all()}
        example_titles_by_id = {
            r.id: r.title
            for r in session.query(StoryRow).filter(StoryRow.is_example.is_(True)).all()
        }

        rewritten_stories = 0
        for row in session.query(StoryRow).all():
            seed_title: str | None = None
            if row.is_example:
                seed_title = row.title
            elif row.forked_from_id:
                seed_title = example_titles_by_id.get(row.forked_from_id) or row.title
            else:
                # User-authored story (not an example, not a fork). Skip even if
                # the title matches a seed — rewriting user chapters would be
                # destructive.
                continue

            seed = seed_by_title.get(seed_title) if seed_title else None
            if seed is None:
                continue

            chapters = json.loads(row.chapters_json) if row.chapters_json else []
            if len(chapters) != len(seed.chapters):
                continue

            chapter_changed = False
            for idx, ch in enumerate(chapters):
                seed_ch = seed.chapters[idx]
                layer_config = ch.get("layer_config") or {}
                current_id = layer_config.get("dataset_id")
                if current_id and current_id not in existing_dataset_ids:
                    source_url = seed_ch.dataset_source_url
                    replacement = dataset_map.get(source_url) if source_url else None
                    if replacement:
                        layer_config["dataset_id"] = replacement
                        ch["layer_config"] = layer_config
                        chapter_changed = True

                conn_id = layer_config.get("connection_id")
                if (
                    conn_id
                    and conn_id not in existing_connection_ids
                    and seed_ch.connection_url
                    and seed_ch.connection_type
                ):
                    replacement = connection_map.get(
                        (seed_ch.connection_url, seed_ch.connection_type)
                    )
                    if replacement:
                        layer_config["connection_id"] = replacement
                        ch["layer_config"] = layer_config
                        chapter_changed = True

                for o_idx, overlay in enumerate(ch.get("overlays") or []):
                    o_conn = overlay.get("connection_id")
                    if not o_conn or o_conn in existing_connection_ids:
                        continue
                    if o_idx >= len(seed_ch.overlays):
                        continue
                    o_seed = seed_ch.overlays[o_idx]
                    replacement = connection_map.get(
                        (o_seed.connection_url, o_seed.connection_type)
                    )
                    if replacement:
                        overlay["connection_id"] = replacement
                        chapter_changed = True

            if chapter_changed:
                row.chapters_json = json.dumps(chapters)
                rewritten_stories += 1
                logger.info(
                    "relinked dead chapter dataset_ids in story %s (%s)",
                    row.id,
                    row.title,
                )

        if rewritten_stories:
            session.commit()
            logger.info(
                "relinked dead chapter dataset_ids in %d stories", rewritten_stories
            )
        return rewritten_stories
    finally:
        session.close()


def seed_example_stories(db_session_factory: sessionmaker) -> None:
    """Seed example stories, rebuilding chapter dataset references from the
    current example-dataset map on every call.

    Behavior per seed entry:

    * If no row exists for the title, INSERT a fresh row.
    * If a row exists, UPDATE its chapters_json, ``dataset_id``, and
      ``description`` from the current seed. This heals dataset-ID drift
      (e.g. after a wipe + re-seed) instead of preserving stale references.

    The title/identity of an existing example row is preserved so that
    forks (which carry ``forked_from_id``) keep pointing at the same
    parent. ``workspace_id`` and ``created_at`` are also preserved.

    Idempotent within a single process and safe under concurrent startups:
    a partial unique index on ``(title) WHERE is_example = TRUE``
    (see ``_migrate_schema``) prevents duplicate example rows, and
    ``IntegrityError`` is caught per-story so a racing insert is a no-op.
    """
    dataset_map = _load_example_dataset_map(db_session_factory)
    connection_map = _load_example_connection_map(db_session_factory)
    existing_rows = _existing_example_story_rows_by_title(db_session_factory)

    for story in ALL_STORIES:
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

        required_conns = {
            (ch.connection_url, ch.connection_type)
            for ch in story.chapters
            if ch.connection_url and ch.connection_type
        }
        required_conns |= {
            (o.connection_url, o.connection_type)
            for ch in story.chapters
            for o in ch.overlays
        }
        missing_conns = required_conns - connection_map.keys()
        if missing_conns:
            logger.warning(
                "skipping example story %r — connections not yet registered: %s",
                story.title,
                sorted(missing_conns),
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
                connection_id=(
                    connection_map.get((ch.connection_url, ch.connection_type))
                    if ch.connection_url and ch.connection_type
                    else None
                ),
                connection_map=connection_map,
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
            existing_id = existing_rows.get(story.title)
            if existing_id is not None:
                row = session.get(StoryRow, existing_id)
                if row is None:
                    # Row vanished between the index load and the update —
                    # fall through to insert.
                    existing_id = None
                else:
                    row.description = story.description
                    row.dataset_id = primary_dataset_id
                    row.chapters_json = json.dumps(chapters_json)
                    row.updated_at = now
                    session.commit()
                    logger.info("refreshed example story: %s", story.title)
                    continue

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
