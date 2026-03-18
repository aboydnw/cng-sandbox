# The GEE → CNG Migration Opportunity

## How CNG Sandbox Can Serve GEE Users — Without Trying to Replace GEE

*Strategic Brief — March 2026*

---

## Executive Summary

Google Earth Engine (GEE) has an enormous installed base — [2,800+ peer-reviewed publications indexed in Scopus through 2022](https://www.mdpi.com/2072-4292/15/14/3675) alone, with [exponential growth continuing through 2025](https://www.mdpi.com/2220-9964/14/11/416) — and scholars from [125 countries contributing research](https://link.springer.com/article/10.1007/s12145-023-01035-2). Yet GEE's commercialization, new quota restrictions, and structural lock-in to Google Cloud are pushing a growing segment of users to explore alternatives.

**CNG Sandbox is not a GEE replacement, and should not try to be one.** GEE's planetary-scale compute remains unmatched for its core use cases. But GEE users face a specific, underserved moment: they've exported their data, left Google's walled garden, and have no idea what to do next. They don't know what COG overviews are, why STAC metadata matters, or how to serve their results on a map without a managed platform.

CNG Sandbox addresses this gap — not as a GEE-specific product, but through its core value proposition of format literacy, interactive inspection, and map building. The GEE opportunity is primarily **a marketing and content angle** (a "GEE Refugees" learning path, targeted blog posts, search-optimized landing pages) with **a small set of product accommodations** (larger file support, GeoTIFF-to-COG conversion, STAC catalog generation from exported files). The strongest unique message to GEE users is cost-oriented: **CNG formats eliminate many of the operations GEE charges EECU-hours for**, and the sandbox teaches the patterns that make expensive compute unnecessary.

---

## PART 1: The GEE User Base — Size, Profile, and Lock-in

### A massive installed base built on a proprietary paradigm

GEE launched in 2010 and rapidly became the default platform for planetary-scale remote sensing analysis. By 2022, [roughly 2,000 peer-reviewed articles had been published using GEE](https://link.springer.com/article/10.1007/s12145-023-01035-2) (indexed in Scopus alone), with 85% of those published in the preceding three years. A broader search across Google Scholar, Scopus, and Web of Science surfaces [roughly 2,800 documents from 125 countries](https://www.mdpi.com/2072-4292/15/14/3675). The growth trajectory suggests the total is now well above 5,000 papers. GEE research is dominated by scholars in China and the US (58% combined), with earth/planetary sciences, environmental science, and agricultural sciences as the top three domains.

The user base extends well beyond academic publishing. [GEE's Code Editor](https://developers.google.com/earth-engine/guides/playground) is taught in university courses worldwide, used by government agencies (USDA, USGS, ESA), NGOs (Global Forest Watch, WRI), and increasingly by commercial operators. The [geemap Python package](https://github.com/gee-community/geemap) — built explicitly to help GEE users transition from the JavaScript API to Python — has 1,300+ GitHub stars and was funded by [NASA under Grant No. 80NSSC22K1742](https://pypi.org/project/geemap/).

### Commercialization is creating cracks

In 2022, Google [launched GEE for commercial use](https://earthengine.google.com/commercial/), requiring [private companies and government operational users to transition to paid accounts](https://developers.google.com/earth-engine/guides/transition_to_commercial). [Commercial pricing is not publicly disclosed](https://us.fitgap.com/products/003259/google-earth-engine) — it requires direct negotiation with Google, creating uncertainty for businesses evaluating the platform.

For noncommercial users, the situation is also tightening. [Starting April 2025, all noncommercial projects must verify eligibility](https://developers.google.com/earth-engine/guides/access) through a questionnaire, and those determined to be commercial lose free access. Google is now introducing [noncommercial quota tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers) that will take effect April 27, 2026, with monthly compute limits (150 EECU-hours for the Community Tier, 1,000 for the Contributor Tier). [Spatial Thoughts recently published a guide on understanding and monitoring these quotas](https://spatialthoughts.com/2026/02/09/gee-quota-monitoring/), signaling community concern.

A [detailed cost analysis by Christopher Ren](https://christopherren.substack.com/p/the-economics-of-earth-engine) found that generating a global annual Sentinel-2 composite on GEE would cost thousands of dollars. His advice to Google: remove monthly membership costs and reduce usage-based costs by 25–50% to be competitive. This pricing pressure is pushing cost-sensitive users — researchers, small companies, startups — to seek alternatives.

### The lock-in is architectural, not just contractual

GEE's lock-in problem runs deeper than pricing. As [one detailed analysis puts it](https://www.matecdev.com/posts/disadvantages-earth-engine.html), after successful prototyping, production deployment will only be possible with Google, because the combination of closed-source infrastructure and proprietary programming frameworks creates profound vendor lock-in. Code written in GEE's JavaScript or Python API is not portable — it relies on server-side objects, proprietary reducers, and Google's map-reduce paradigm that does not map to standard Python geospatial libraries.

[Multiple](https://medium.com/@bikesbade/google-earth-engine-disadvantages-and-limitations-98b45d672911) [sources](https://offnadir-delta.com/blog/google-earth-engine-satellite-analysis) identify the same pattern: GEE is excellent for prototyping but creates a trap where moving to production or switching platforms requires essentially starting over. The [Pangeo community has articulated this tension clearly](https://medium.com/pangeo/closed-platforms-vs-open-architectures-for-cloud-native-earth-system-analytics-1ad88708ebb6): GEE was assumed to be the future of big geospatial data, but "that clearly didn't happen" because the platform is closed and not open source. Pangeo's open architecture — built on xarray, Dask, and Zarr — allows any organization to deploy computing next to data using their own tools, eliminating the need for a single "one-stop shop."

---

## PART 2: User Frustration Signals

### Frustration #1 — "Exporting is a headache"

[Exporting from GEE](https://developers.google.com/earth-engine/guides/exporting_images) is a persistent pain point. While GEE now supports [cloud-optimized GeoTIFF export](https://developers.google.com/earth-engine/guides/exporting_images), the process is batch-mode, often slow, and routes through Google Drive or Google Cloud Storage. Large exports can take over 24 hours and sometimes fail after running for that long. The [official scaling guide](https://google-earth-engine.com/Advanced-Topics/Scaling-up-in-Earth-Engine/) acknowledges this bluntly: "For users, this can be frustrating. We generally find it simpler to run several small jobs rather than one large job."

Users who want to bring their analysis results into the broader CNG ecosystem face friction: GEE exports don't automatically produce STAC metadata, don't integrate with STAC catalogs, and COG-backed assets can [only be read from Google Cloud Storage](https://developers.google.com/earth-engine/Earth_Engine_asset_from_cloud_geotiff) — not from AWS S3 or any other HTTP server. As [one geemap tutorial notes](https://blog.gishub.org/gee-tutorial-38-how-to-use-cloud-optimized-geotiff-with-earth-engine): "only Cloud Optimized GeoTIFF hosted on Google Cloud Storage is supported."

### Frustration #2 — The proprietary API is a dead end

GEE's server-side programming model — requiring functional programming patterns, no standard loop iteration, confusion between client-side and server-side objects — is a frequent source of complaint. As described in [one analysis](https://www.matecdev.com/posts/disadvantages-earth-engine.html), GEE's map-reduce approach "enables massive parallelism but increases the complex coding style" and the combination of server and client-side programming "tends to be confusing." Simple tasks like index iteration behave unexpectedly because the index is client-side while the computation is server-side.

[Multiple reviews note](https://medium.com/@bikesbade/google-earth-engine-disadvantages-and-limitations-98b45d672911) that GEE's Python API, while it exists, calls closed-source proprietary frameworks under the hood. Code written for GEE cannot be run on any other platform. Skills learned in GEE's paradigm do not directly transfer to the Python geospatial ecosystem (rasterio, xarray, geopandas, dask) that the rest of the CNG community uses.

### Frustration #3 — Users actively seeking alternatives

A [Planetary Computer GitHub discussion](https://github.com/microsoft/PlanetaryComputer/discussions/297) captures the migration impulse perfectly: a user describes building a web app backend on GEE's JS API and wanting to replace it with Planetary Computer instead, explicitly saying "I dont like the strange GEE way of doing things." The response reveals the gap: Planetary Computer's STAC API provides data access, but lacks GEE's included compute layer.

[ResearchGate threads](https://www.researchgate.net/post/Are_there_alternatives_to_Google_Earth_Engine) regularly surface researchers asking about alternatives to GEE, with Microsoft Planetary Computer and QGIS as the most common suggestions. [G2's alternatives page](https://www.g2.com/products/google-earth-engine/competitors/alternatives) for GEE lists ArcGIS Pro, Esri ArcGIS, and Tableau — suggesting the comparison set most users are aware of is commercial GIS, not the open CNG ecosystem. This is exactly the awareness gap CNG Sandbox could fill.

### Frustration #4 — Quota limits and "computation timed out"

The [GEE scaling guide](https://google-earth-engine.com/Advanced-Topics/Scaling-up-in-Earth-Engine/) opens by acknowledging that when users move from tutorials to their own scripts, they encounter "the dreaded error messages, 'computation timed out' or 'user memory limit exceeded.'" [Batch task restrictions](https://developers.google.com/earth-engine/batch-task-restrictions) explicitly warn that spreading workloads across multiple accounts "degrades performance for other users and violates the Terms of Service" — meaning users have no sanctioned workaround for compute limits.

With the new [noncommercial quota tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers) taking effect in April 2026, even academic users will face hard monthly EECU-hour caps. This creates a structural incentive to learn CNG workflows that run on infrastructure the user controls.

---

## PART 3: Technical Gap Analysis — What GEE Cannot Do

### CNG format support is narrow and GCS-locked

| Format | GEE Support | CNG Ecosystem Support |
|---|---|---|
| **COG** | Read from GCS only; [export supported](https://developers.google.com/earth-engine/guides/exporting_images) | Universal — read from any HTTP server (S3, Azure, GCS, self-hosted) |
| **STAC** | [Catalog published in STAC format](https://github.com/google/earthengine-catalog) but no native API for querying external STAC catalogs | Full ecosystem: pystac, stac-fastapi, pgSTAC, STAC Browser, 120M+ items across 4,000+ collections |
| **PMTiles** | Zero support | Native in MapLibre, Kepler.gl, Foursquare Studio, leafmap |
| **Zarr** | [Limited v2 support added 2025](https://developers.google.com/earth-engine/docs/server/release-notes) via `ee.Image.loadZarrV2Array()` | Full ecosystem: xarray, Dask, titiler-xarray, zarr-cesium |
| **GeoParquet** | No support | Growing adoption: DuckDB spatial, QGIS, kepler.gl, BigQuery |

The key insight: GEE's format support is not just incomplete — it's structurally limited to Google's own cloud. A COG on AWS S3, which powers the largest public STAC catalogs (Element 84's Earth Search, NASA CMR), cannot be read by GEE. This means GEE users who export their data and want to participate in the broader CNG ecosystem need to learn how these formats work — which is exactly what CNG Sandbox teaches, regardless of whether the user came from GEE or anywhere else.

### The API portability gap

GEE's API is fundamentally different from the standard Python geospatial stack:

| GEE Concept | CNG Equivalent |
|---|---|
| `ee.Image` / `ee.ImageCollection` | `rasterio` + `xarray.DataArray` |
| `ee.Reducer` | `numpy` / `xarray` reductions |
| Server-side `map()` / `iterate()` | `dask.delayed` / `dask.array` |
| `Export.image.toDrive()` | Direct file writes (COG via `rio-cogeo`, Zarr via `zarr-python`) |
| GEE Code Editor | Jupyter / VS Code / Observable / **CNG Sandbox** |

Users who learn GEE's paradigm must essentially relearn geospatial programming to use CNG tools. This is exactly the transition a sandbox can smooth.

### geemap → leafmap: the bridge already exists — and that's fine

[Qiusheng Wu explicitly designed leafmap](https://leafmap.org/) as a spin-off of geemap for "non-GEE users," stating: "not everyone in the geospatial community has access to the GEE cloud computing platform. Leafmap is designed to fill this gap." [Geemap](https://geemap.org/) includes an automated JavaScript-to-Python converter, and leafmap adds native COG, STAC, PMTiles, and Zarr support without requiring a GEE account.

For users who are comfortable writing Python — and that population is growing fast with AI coding assistants — leafmap is already a strong migration path. **We should not try to compete with leafmap on this ground.** CNG Sandbox's value for GEE users is different: it serves the users who don't want to write Python (or don't want to yet), who need to understand formats before they write code, and who want to visually build and prototype map applications rather than produce notebooks. It's a complementary tool, not a replacement for leafmap.

---

## PART 4: The CNG Sandbox Opportunity

### Positioning: Not a GEE replacement — the "what comes after export" tool

Our earlier framing — "everything you do in GEE Code Editor, but with open standards" — overpromises. GEE's Code Editor includes planetary-scale compute, a curated multi-petabyte catalog, and instant visualization. We don't offer any of that, and leafmap + an AI coding assistant already covers the Python-based transition path well.

What we uniquely offer is the **post-export moment**: a browser-native environment where a GEE user who just downloaded a pile of GeoTIFFs to Google Drive can immediately understand what they have, optimize it, catalog it, and build something with it — without installing Python, setting up a Jupyter server, or learning a new programming language. The sandbox is the answer to "I exported my data from GEE. Now what?"

Our differentiators over leafmap for this audience are: zero setup (no Python, no Jupyter, no conda), interactive format inspection (see COG overviews, STAC schemas, PMTiles tile indices), visual map building (drag-and-drop, not code), and the "built by the makers" trust that comes from DevSeed's authorship of the tools these formats depend on.

### A "Coming from GEE?" learning path

Rather than a full "GEE Refugees" track (which overstates our role), a lightweight learning path that meets GEE users at their point of need:

1. **"You just exported a GeoTIFF — let's optimize it."** Upload a standard GeoTIFF, convert it to COG in the sandbox, and see the difference: internal tiling, overviews, range-request access. Show why this matters for cost and performance.
2. **"Turn your exports into a catalog."** Drop multiple exported files, generate STAC Items with spatial/temporal metadata, export a STAC catalog. This is the step GEE never taught because GEE handles cataloging internally.
3. **"Discover public data without GEE."** Search Element 84's Earth Search API for the same Sentinel-2 data they access via `ee.ImageCollection('COPERNICUS/S2')`. Show that STAC gives them access to the same data, vendor-free.
4. **"Build a map app you can host anywhere."** Use the sandbox's visual map builder to create a viewer for their data — COGs on S3, PMTiles basemap — deployable as a static site. No GEE Apps, no EECU costs per interaction.

### Why the timing is perfect

Three forces are converging to make GEE users receptive to CNG alternatives right now:

**First**, the [noncommercial quota tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers) taking effect April 2026 will be the largest disruption to GEE's free-access model since commercialization. Academic users who previously had unlimited compute will suddenly need to monitor EECU-hours. Some will exceed their tier and face degraded performance. This creates a window where users are actively evaluating alternatives.

**Second**, the CNG ecosystem has matured to the point where it's a credible replacement for many GEE use cases. [QGIS now has native STAC support](https://talks.osgeo.org/qgis-uc2024/talk/9HPZUQ/). Leafmap provides one-liner COG and STAC visualization. TiTiler powers production tile serving at NASA and Microsoft scale. The tools exist — what's missing is the interactive onramp.

**Third**, the [Pangeo community](https://pangeo.io/) has proven that the open xarray + Dask + Zarr stack can match GEE's scale for climate and weather data. As [Ryan Abernathey wrote](https://medium.com/pangeo/closed-platforms-vs-open-architectures-for-cloud-native-earth-system-analytics-1ad88708ebb6), the open architecture "can run on any cloud, or on virtually any on-premises hardware" — but the tooling remains fragmented and hard to discover. CNG Sandbox doesn't replace Pangeo's compute, but it can be the front door where users first encounter the formats and patterns that Pangeo's stack depends on.

### Sizing the addressable segment (honestly)

Not all GEE users are migration candidates — many are deeply embedded in the GEE ecosystem and satisfied, and many will simply absorb the new quota tiers. The segments most relevant to CNG Sandbox are not the ones looking to replace GEE's compute, but rather:

- **The "post-export" user**: Anyone who has exported data from GEE and needs to do something with it outside Google's ecosystem — catalog it, serve it, build a viewer. This is a format literacy problem, not a compute problem.
- **Cost-conscious teams**: Commercial users facing [$0.40/batch EECU-hour plus $500+/month platform fees](https://sanborn.com/blog/google-earth-engine-frequently-asked-questions/) who want to understand whether CNG patterns can reduce their costs for visualization, data serving, and app deployment (they can).
- **Government teams with dual mandates**: Agencies that use GEE internally but are also required to publish data via STAC (NASA, ESA, NOAA mandates). They need to understand CNG formats regardless of their GEE usage.
- **The "hybrid" user**: [Many practitioners](https://offnadir-delta.com/blog/google-earth-engine-satellite-analysis) already use GEE for initial exploration and then process final results locally. CNG Sandbox serves the second half of that workflow.

Crucially, **this audience largely overlaps with the broader CNG learner community** we're already targeting. We don't need a separate product for GEE users — we need content that meets them where they are and product accommodations (Part 7) that handle what they arrive with.

---

## PART 5: Risks and Counterarguments

### "GEE users don't know they need CNG"

This is true — and it's also the opportunity. Most GEE users don't know about STAC, COG range requests, or PMTiles because GEE abstracts these concepts away. But when they need to use data outside GEE, or when quotas force them to explore alternatives, they discover the gap. CNG Sandbox should position itself as the tool they find at that moment.

### "Google could just add STAC support"

Google [already publishes its catalog in STAC format](https://github.com/google/earthengine-catalog), but notably does not allow GEE to query external STAC APIs. Adding full STAC support would undermine GEE's lock-in strategy — Google benefits from keeping users inside GCS. Even if Google added STAC querying, it would still be a proprietary platform consuming open data, not an open tool teaching open standards.

### "GEE's compute advantage is too strong"

For planetary-scale analysis, GEE remains unmatched in ease of use. CNG Sandbox should not try to compete on compute. Instead, it should target the learning, prototyping, and transition workflows — users who are starting to explore beyond GEE, not users who are doing a global forest change analysis. The sandbox is an on-ramp, not a replacement.

---

## PART 6: The Cost Positioning — "CNG Formats Save You Money"

### GEE's cost structure penalizes the patterns CNG eliminates

[GEE commercial pricing](https://cloud.google.com/earth-engine/pricing) charges [$0.40 per batch EECU-hour and $1.33 per online EECU-hour](https://sanborn.com/blog/google-earth-engine-frequently-asked-questions/), plus a [monthly platform fee starting at $500/month](https://www.earthblox.io/resources/advantages-and-disadvantages-of-google-earth-engine) for the Basic plan. [Christopher Ren's cost analysis](https://christopherren.substack.com/p/the-economics-of-earth-engine) estimated that exporting a global annual Sentinel-2 composite would cost $40,000–$160,000 in EECU-hours alone. For noncommercial users, the new [quota tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers) cap free compute at 150 EECU-hours/month (Community) or 1,000 EECU-hours/month (Contributor), with degraded performance after exhaustion.

The crucial insight for CNG Sandbox positioning is: **many of the operations GEE charges EECU-hours for are operations that CNG formats eliminate entirely.** CNG Sandbox can teach users the patterns that make those costs disappear.

### Five CNG patterns that reduce or eliminate compute costs

**Pattern 1: HTTP range requests instead of full-file downloads.** A COG with internal tiling and overviews lets any client request just the bytes it needs via HTTP GET Range. Viewing a 10GB Landsat scene at zoom level 8? The client fetches a few hundred KB of overview tiles, not the full file. In GEE, every visualization request consumes EECUs because the server renders tiles. With a COG on S3, the storage serves the bytes directly — no compute layer, no EECU cost. The "compute" is just HTTP serving, which costs fractions of a cent per thousand requests.

**Pattern 2: STAC search instead of server-side filtering.** In GEE, filtering an `ee.ImageCollection` by date, bounds, and cloud cover runs server-side and consumes EECUs. A STAC API query does the same filtering as a lightweight metadata search — no pixel processing, no compute units. The data is indexed, the query is fast, and it's free (or nearly free) to run.

**Pattern 3: Client-side rendering eliminates tile server costs.** Libraries like `geotiff.js` and `maplibre-cog-protocol` render COGs directly in the browser. PMTiles serve vector and raster tiles from a single file on S3 with zero server infrastructure. GEE users pay for every tile rendered through Google's infrastructure. CNG users push rendering to the client browser and pay only for object storage — typically $0.023/GB/month on S3.

**Pattern 4: Process only what you need, where you choose.** GEE's map-reduce model processes entire image collections server-side, which is powerful but opaque — you can't control where or how the compute runs. With CNG formats, users can pull exactly the spatial/temporal subset they need (via COG range requests or Zarr chunk access) and process it locally, on a $5/month VM, or on a Dask cluster. The compute cost is transparent and under their control.

**Pattern 5: Static hosting replaces managed infrastructure.** A GEE App runs on Google's infrastructure, consuming EECUs for every user interaction. A map application built with CNG data sources (COGs on S3, PMTiles basemap, STAC catalog) can be hosted as a static site on Vercel, Netlify, or an S3 bucket — effectively free for moderate traffic. The CNG Sandbox map builder teaches users to create exactly this kind of application.

### How CNG Sandbox teaches these patterns

CNG Sandbox doesn't need to *provide* cheap compute — it needs to **teach users that CNG formats make expensive compute unnecessary for many workflows.** The sandbox can demonstrate each pattern interactively:

- Load a COG and show the network tab — watch the range requests fetch only the visible tiles, not the whole file
- Search a STAC catalog and show that the same Sentinel-2 filtering that costs EECUs in GEE is a free metadata query here
- Drag a PMTiles file into the sandbox and see a full vector basemap render with zero server infrastructure
- Inspect a Zarr store's chunk structure and understand why you can read a single timestep without loading the whole dataset

The message to GEE users isn't "come use our compute instead of Google's." It's: **"learn the formats that let you stop paying for compute you don't need."**

---

## PART 7: Product Accommodations for GEE Refugees

### What GEE users arrive with

GEE users leaving the platform typically carry:

- **GeoTIFFs (often COGs)**: GEE's primary export format. The `cloudOptimized: true` flag is available and increasingly used. Users may also have standard (non-optimized) GeoTIFFs from older exports.
- **CSVs and Shapefiles**: From `Export.table.toDrive()` — tabular results of zonal statistics, feature collections.
- **Large files**: GEE exports can produce multi-GB files, especially for high-resolution or multi-band imagery. Files over 2GB are automatically split into tiles with filenames like `baseFilename-yMin-xMin`.
- **No metadata**: GEE exports don't include STAC metadata, sidecar files, or catalog structure. Users have files but no catalog.
- **GEE scripts**: JavaScript or Python code that only runs on GEE's servers. Not portable.

### Product tweaks to accommodate this audience

**1. Support larger file uploads and non-optimized GeoTIFFs.** GEE users will arrive with files that are potentially larger and less cloud-optimized than what a typical CNG-native user would bring. The sandbox should handle standard GeoTIFFs (not just COGs) gracefully — ideally with an inline "Convert to COG" step that shows the user what optimization does and why it matters. This is a teaching moment, not just a feature.

**2. Provide a "Catalog your exports" workflow.** The single most useful thing the sandbox can do for a GEE refugee is help them turn a pile of exported GeoTIFFs into a STAC catalog. A guided flow: "Drop your files here → we'll inspect them → generate STAC Items with spatial/temporal metadata → export a STAC catalog you can host anywhere." This directly addresses the gap between "I exported my data from GEE" and "now what?"

**3. Show the GEE equivalent alongside CNG concepts.** In learning paths, include callouts like: "In GEE, you'd do `ee.ImageCollection('COPERNICUS/S2').filterDate(...)`. Here, the same operation is a STAC API search." This reduces cognitive load for users who already have a mental model — they just need to map it to new tools.

**4. Demonstrate that the ecosystem is feature-complete.** GEE users are accustomed to a rich, integrated environment. They need assurance that leaving GEE doesn't mean losing capabilities. The sandbox should surface the ecosystem: "For band math, use rasterio or xarray. For classification, use scikit-learn. For time series, use xarray + Dask. For visualization, use TiTiler or the map builder. For deployment, export a static app." A "GEE → CNG toolkit mapping" reference would be high-value.

**5. Address the "but where do I run my analysis?" question.** CNG Sandbox isn't the compute layer, but it should point users to their options: Google Colab (free, familiar to GEE users), a personal cloud VM, Pangeo JupyterHub, or managed platforms like Microsoft Planetary Computer's Hub. The sandbox teaches the formats and patterns; these platforms provide the compute. Being explicit about this avoids the disappointment of "I thought this replaced GEE."

### What we should NOT build

- **A GEE-compatible compute layer.** This would be massively expensive, off-strategy, and compete with Google on their strongest ground.
- **A GEE API compatibility shim.** Translating `ee.Image` calls to rasterio would be brittle and send the wrong message. The point is to learn the open stack, not to pretend the open stack is GEE.
- **GEE account integration.** Connecting to a user's GEE account from the sandbox would add complexity and tie us to Google's API changes. Users should export their data and bring it to the sandbox.

---

## Repurposable External Section: "From GEE to Open Geospatial"

*The following section is written for potential external use — a blog post, landing page, or conference talk aimed at GEE users.*

---

### You exported your data from GEE. Here's what to do next.

If you've been using Google Earth Engine, you've probably exported GeoTIFFs to Google Drive, maybe turned on the `cloudOptimized` flag, and ended up with a folder full of files. Now what?

GEE is great at what it does — planetary-scale analysis with zero infrastructure. But once your data leaves GEE, you're on your own. There's no catalog telling you what's in those files. No tile server to visualize them. No way to share them as an interactive map without spinning up infrastructure.

The rest of the geospatial world has solved these problems with **cloud-native geospatial (CNG)** — a set of open formats and standards that make your data self-describing, streamable, and servable without expensive compute.

**What are CNG formats?**

- **COG (Cloud Optimized GeoTIFF)**: The same GeoTIFFs you know, but with internal tiling and overviews that let any app stream just the pixels it needs via HTTP — from AWS, Azure, Google Cloud, or your own server.
- **STAC (SpatioTemporal Asset Catalog)**: A standard way to describe and search satellite imagery. NASA, ESA, USGS, and Planet all publish STAC catalogs. There are 120 million+ items indexed across 4,000+ collections.
- **PMTiles**: A single-file format for vector and raster map tiles — host a complete basemap from a single file on S3, no tile server needed.
- **Zarr**: Multidimensional arrays in the cloud — like NetCDF, but cloud-native and chunk-accessible.

**What changes?**

| In GEE you... | In CNG you... |
|---|---|
| Use `ee.ImageCollection('COPERNICUS/S2')` | Search a STAC API for Sentinel-2 items |
| Call `ee.Image.loadGeoTIFF()` (GCS only) | Load a COG from any URL with rasterio or a browser viewer |
| Write GEE's proprietary JavaScript/Python | Use standard Python (xarray, rasterio, geopandas) or JavaScript (geotiff.js, MapLibre) |
| Export to Google Drive | Write directly to S3, Azure, or your filesystem |
| Deploy as a GEE App | Build a web map with MapLibre, deck.gl, or a visual builder |

**What doesn't change?**

The data is the same. Landsat, Sentinel, MODIS — the same satellites, the same archives. CNG just gives you open, portable ways to access and analyze them without depending on a single platform.

**Why does this save you money?**

Many of the operations GEE charges EECU-hours for — tile rendering, collection filtering, app serving — are operations that CNG formats handle without a compute layer at all. A COG streams its own tiles via HTTP. A STAC query is a metadata search, not a pixel operation. A PMTiles basemap serves from S3 with zero server costs. Learning these patterns doesn't just free you from vendor lock-in — it reduces your infrastructure costs for visualization, data sharing, and app deployment.

**Where to start?**

CNG Sandbox lets you explore all of this in your browser — no setup, no accounts, no downloads. Upload the GeoTIFFs you exported from GEE, convert them to optimized COGs, generate STAC metadata, and build an interactive map application. It's built by the team that created the tools powering NASA and ESA's own CNG infrastructure.

---

## Source Index

### GEE Platform & Documentation
- [Google Earth Engine Homepage](https://earthengine.google.com/)
- [GEE Code Editor](https://developers.google.com/earth-engine/guides/playground)
- [GEE Access & Registration](https://developers.google.com/earth-engine/guides/access)
- [GEE Commercial Use](https://earthengine.google.com/commercial/)
- [GEE Noncommercial Use](https://earthengine.google.com/noncommercial/)
- [Transition to Commercial Projects](https://developers.google.com/earth-engine/guides/transition_to_commercial)
- [GEE Pricing](https://cloud.google.com/earth-engine/pricing)
- [GEE Noncommercial Tiers (April 2026)](https://developers.google.com/earth-engine/guides/noncommercial_tiers)
- [GEE Quotas](https://developers.google.com/earth-engine/guides/usage)
- [GEE Batch Task Restrictions](https://developers.google.com/earth-engine/batch-task-restrictions)
- [GEE Exporting Images](https://developers.google.com/earth-engine/guides/exporting_images)
- [GEE COG-backed Assets](https://developers.google.com/earth-engine/Earth_Engine_asset_from_cloud_geotiff)
- [GEE Server Release Notes](https://developers.google.com/earth-engine/docs/server/release-notes)
- [GEE Coding Best Practices](https://developers.google.com/earth-engine/guides/best_practices)
- [GEE Scaling Up Guide](https://google-earth-engine.com/Advanced-Topics/Scaling-up-in-Earth-Engine/)
- [GEE Announcements (Google Groups)](https://groups.google.com/g/google-earthengine-announce)
- [GEE FAQ](https://earthengine.google.com/faq/)
- [Earth Engine STAC Catalog (GitHub)](https://github.com/google/earthengine-catalog)
- [GEE STAC Extension Discussion (stac-spec #1084)](https://github.com/radiantearth/stac-spec/issues/1084)
- [GEE Year in Review (Google Cloud Blog)](https://cloud.google.com/blog/topics/sustainability/look-back-at-a-year-of-earth-engine-advancements)
- [Daily EECU Limits Announcement](https://medium.com/google-earth/stay-on-budget-with-new-daily-eecu-time-limits-29becacce1a2)

### User Frustration & Alternatives
- [GEE Goes Commercial: 5 Things to Consider](https://www.matecdev.com/posts/disadvantages-earth-engine.html)
- [GEE Disadvantages and Limitations (Medium)](https://medium.com/@bikesbade/google-earth-engine-disadvantages-and-limitations-98b45d672911)
- [GEE for Satellite Analysis: Power and Limitations (Off-Nadir Delta)](https://offnadir-delta.com/blog/google-earth-engine-satellite-analysis)
- [The Economics of Earth Engine (Christopher Ren)](https://christopherren.substack.com/p/the-economics-of-earth-engine)
- [GEE Commercial Billing Discussion (geemap #1237)](https://github.com/gee-community/geemap/discussions/1237)
- [GEE API Pricing Discussion (Google Dev Forums)](https://discuss.google.dev/t/google-earth-engine-api-pricing/280720)
- [GEE Reviews 2026 (FitGap)](https://us.fitgap.com/products/003259/google-earth-engine)
- [Replacing GEE with Planetary Computer (Discussion #297)](https://github.com/microsoft/PlanetaryComputer/discussions/297)
- [Are There Alternatives to GEE? (ResearchGate)](https://www.researchgate.net/post/Are_there_alternatives_to_Google_Earth_Engine)
- [GEE Alternatives (G2)](https://www.g2.com/products/google-earth-engine/competitors/alternatives)
- [GEE Alternatives (FlyPix AI)](https://flypix.ai/google-earth-engine-alternatives/)
- [GEE Alternatives (AI Superior)](https://aisuperior.com/google-earth-engine-alternatives/)
- [Understanding GEE Quota (Spatial Thoughts)](https://spatialthoughts.com/2026/02/09/gee-quota-monitoring/)
- [Advantages and Disadvantages of GEE (Earth Blox)](https://www.earthblox.io/resources/advantages-and-disadvantages-of-google-earth-engine)

### Academic Research on GEE
- [GEE Bibliometric Analysis — Scopus 2015–2022 (Springer)](https://link.springer.com/article/10.1007/s12145-023-01035-2)
- [GEE Global Analysis and Future Trends (MDPI)](https://www.mdpi.com/2072-4292/15/14/3675)
- [GEE Applications Since Inception (MDPI)](https://www.mdpi.com/2072-4292/10/10/1509)
- [GEE for LULC Change Analysis — Trends 2016–2025 (MDPI)](https://www.mdpi.com/2220-9964/14/11/416)
- [GEE Systematic Review and Meta-analysis (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2352938522002154)
- [GEE Meta-analysis — Geo-Big Data (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0924271620300927)

### The geemap → leafmap Bridge
- [geemap GitHub](https://github.com/gee-community/geemap)
- [geemap on PyPI](https://pypi.org/project/geemap/)
- [geemap Documentation](https://geemap.org/)
- [geemap Book (Locate Press)](https://book.geemap.org/chapters/01_introduction.html)
- [geemap STAC Catalog Issue (#346)](https://github.com/gee-community/geemap/issues/346)
- [leafmap Homepage](https://leafmap.org/)
- [leafmap GEE Integration](https://leafmap.org/maplibre/google_earth_engine/)
- [Open Geospatial Data Science with Geemap & Leafmap (ADS)](https://ui.adsabs.harvard.edu/abs/2021AGUFM.U51B..24W/abstract)
- [COG Tutorial for GEE (gishub.org)](https://blog.gishub.org/gee-tutorial-38-how-to-use-cloud-optimized-geotiff-with-earth-engine)

### Pangeo & Open Architecture
- [Closed Platforms vs. Open Architectures (Pangeo Medium)](https://medium.com/pangeo/closed-platforms-vs-open-architectures-for-cloud-native-earth-system-analytics-1ad88708ebb6)
- [Pangeo Homepage](https://pangeo.io/)
- [Pangeo ML Ecosystem (xarray.dev)](https://xarray.dev/blog/pangeo-ml-ecosystem-2023)
- [Pangeo + GEE Discussion (GitHub #216)](https://github.com/pangeo-data/pangeo/issues/216)
- [Cloud Native Geoprocessing with Pangeo (Medium)](https://medium.com/pangeo/cloud-native-geoprocessing-of-earth-observation-satellite-data-with-pangeo-997692d91ca2)
- [Pangeo: Earth Science (Dask Stories)](https://stories.dask.org/en/latest/pangeo.html)
- [Pangeo ML — NASA Earthdata](https://www.earthdata.nasa.gov/about/competitive-programs/access/pangeo-ml)
- [Pangeo Forge (FOSS4G 2022)](https://talks.osgeo.org/foss4g-2022/talk/DABTGG/)

### CNG Format References
- [Cloud Optimized GeoTIFF (cogeo.org)](https://cogeo.org/)
- [COG in CNG (gillanscience.com)](https://www.gillanscience.com/cloud-native-geospatial/cog/)
- [COG Driver — GDAL Documentation](https://gdal.org/en/latest/drivers/raster/cog.html)

### GEE Pricing & Cost Controls
- [GEE Pricing (Google Cloud)](https://cloud.google.com/earth-engine/pricing)
- [GEE FAQ — Pricing (Sanborn)](https://sanborn.com/blog/google-earth-engine-frequently-asked-questions/)
- [GEE Advantages/Disadvantages incl. Pricing (Earth Blox)](https://www.earthblox.io/resources/advantages-and-disadvantages-of-google-earth-engine)
- [The Economics of Earth Engine (Christopher Ren)](https://christopherren.substack.com/p/the-economics-of-earth-engine)
- [GEE Noncommercial Tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers)
- [GEE Cost Controls](https://developers.google.com/earth-engine/guides/cost_controls)
- [GEE Computation Overview — EECUs](https://developers.google.com/earth-engine/guides/computation_overview)
- [Daily EECU Limits Announcement](https://medium.com/google-earth/stay-on-budget-with-new-daily-eecu-time-limits-29becacce1a2)
