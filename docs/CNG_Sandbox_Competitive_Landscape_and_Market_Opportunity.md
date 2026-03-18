# CNG Sandbox: Competitive Landscape and Market Opportunity

**Development Seed is positioned to fill a clear gap in the cloud-native geospatial ecosystem.** No existing product combines an interactive browser-based sandbox, deep support for CNG formats (COG, STAC, PMTiles, Zarr), and structured learning paths — despite strong and growing demand. The CNG community identified education as its **#1 priority** at the [2025 CNG Conference](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025), and [STAC has now been adopted as an OGC Community Standard](https://stacspec.org/en/about/) with **[120 million+ indexed items across 4,000+ collections](https://developers.planet.com/blog/2022/Aug/31/state-of-stac/)**. The [geospatial analytics market exceeds $85 billion](https://www.grandviewresearch.com/industry-analysis/geospatial-analytics-market) and is growing at [11–13% CAGR](https://www.giiresearch.com/report/moi1849868-geospatial-analytics-market-share-analysis.html), with the services segment accelerating at 12.9% due to a widening skills gap. DevSeed's position as the creator of TiTiler, eoAPI, and core STAC infrastructure gives it an authentic "built by the makers" advantage that no competitor can replicate.

---

## PART 1: Competitive Landscape

### CNG-specific tools occupy narrow, non-overlapping niches

The existing CNG tooling ecosystem is fragmented into single-purpose instruments. No tool attempts what CNG Sandbox proposes — a unified learning and prototyping environment across formats.

**[STAC Browser](https://github.com/radiantearth/stac-browser)** (radiantearth/stac-browser, ~881 GitHub stars) is the de facto standard for browsing STAC catalogs. It is a Vue.js application supporting STAC APIs and static catalogs with map previews, COG rendering, and PMTiles link types. A v5 rewrite (Vue 3, Vite) is targeted for Q1 2026 and v6 with a pluggable interface for Q4 2026. However, it is strictly read-only — no coding, no prototyping, no educational content, and no Zarr support. Limited funding constrains its development pace.

**[Microsoft Planetary Computer](https://learn.microsoft.com/en-us/azure/planetary-computer/stac-overview)** is the most feature-complete CNG platform available today. Its Explorer provides polished visualization of 100+ datasets via TiTiler-pgSTAC dynamic tiling, and its Hub offers managed JupyterHub co-located with data on Azure. The STAC API is powered by [stac-fastapi + pgSTAC](https://element84.com/geospatial/how-microsofts-planetary-computer-uses-stac/). In 2025, Microsoft launched **[Planetary Computer Pro](https://learn.microsoft.com/en-us/azure/planetary-computer/ingestion-overview)** (GA), an Azure service for creating custom GeoCatalogs that auto-converts uploads to COGs. Its weaknesses as a CNG learning tool are significant: it requires Azure account approval, is locked to Microsoft's ecosystem, and does not teach CNG concepts — it simply uses them behind the scenes. It is a data consumption platform, not a format exploration sandbox.

**[Google Earth Engine](https://developers.google.com/earth-engine/guides/playground)** remains the dominant planetary-scale analysis platform with its JavaScript Code Editor and massive catalog. CNG format support is limited and proprietary: COGs only from [Google Cloud Storage](https://geemap.org/notebooks/38_cloud_geotiff/), new Zarr v2 support via `ee.Image.loadZarrV2Array()` (2025), no native STAC support, and no PMTiles. GEE actively encourages its own paradigm rather than open CNG standards. Its Code Editor is the closest UX analog to what a CNG Sandbox might look like, but it serves a fundamentally different purpose.

**Element 84's [Earth Search](https://github.com/Element84/earth-search)** is one of the most widely used public STAC APIs, indexing Sentinel-2, Landsat, Sentinel-1, Copernicus DEM, and NAIP on AWS. Their **[Earth Search Console](https://element84.com/design/ui-ux/introducing-earth-search-console-an-aws-open-data-exploration-ui)** (built on FilmDrop-UI) provides map-centric visualization with geohex aggregation. [FilmDrop](https://element84.com/filmdrop/) is a broader suite for data ingest, processing, and distribution. [Element 84](https://element84.com/) is a strong CNG ecosystem player (they manage the Sentinel-2 STAC catalog, and Matt Hanson — formerly of DevSeed — drives their STAC work). Their focus is infrastructure and data pipelines, not developer education or prototyping.

**[eoAPI](https://github.com/developmentseed/eoAPI)** (Development Seed, ~290 GitHub stars) is the most comprehensive open-source STAC stack available, combining pgSTAC, stac-fastapi, TiTiler-pgSTAC, TiPG, and STAC Browser. It powers **[NASA VEDA, NASA MAAP, NASA CSDA, ESA EOPCA, and Microsoft Planetary Computer](https://developmentseed.org/blog/2023-07-17-say-hello-eoapi/)**, serving metadata for **over 1 billion STAC items** and generating hundreds of thousands of tiles daily. [New additions include STAC Manager and STAC Auth Proxy](https://developmentseed.org/blog/2025-06-18-eoapi/). Despite this power, eoAPI requires [Docker/Kubernetes expertise and multiple services](https://eoapi.dev/intro/) to deploy locally — a significant barrier for learners and prototypers.

**[TiTiler](https://github.com/developmentseed/titiler/blob/main/README.md)** (DevSeed, ~1,000 GitHub stars, 63+ contributors) is the dynamic tile server underpinning Planetary Computer Explorer and NASA VEDA. It supports COG, STAC, MosaicJSON, and Zarr (via titiler.xarray). It includes a minimal built-in viewer at `/cog/viewer` useful for debugging but not for teaching. The latest release (v0.26.0, November 2025) shows vigorous development.

**Format-specific viewers** serve narrow purposes well but do not overlap with the sandbox concept. **[COG Explorer](https://geotiffjs.github.io/cog-explorer/)** (geotiffjs/cog-explorer) is a proof-of-concept browser app using geotiff.js for client-side COG rendering without a tile server — technically impressive but limited to a single format. **[PMTiles Viewer](https://protomaps.com/blog/new-pmtiles-io/)** (pmtiles.io, ~2,400 stars) from Protomaps was recently rewritten (May 2025) with raster support, TileJSON viewing, and local file drag-and-drop. It's excellent for PMTiles inspection but covers no other CNG format.

Other ecosystem tools include **[stac-utils](https://github.com/stac-utils)** (stac-fastapi ~307 stars, pystac ~424 stars, pystac-client ~196 stars), and a growing constellation of utilities (stac-geoparquet, rio-stac, stactools, rustac). **[Franklin](https://medium.com/radiant-earth-insights/azaveas-server-franklin-now-supports-the-latest-stac-api-2343437c72cd)** (Azavea, ~82 stars) appears largely stalled since October 2023. DevSeed's own **[stac-map](https://developmentseed.org/blog/2025-09-02-stacmap/)** (September 2025) is a map-first STAC explorer using DuckDB in the browser and deck.gl — an experimental tool showing the building blocks for a sandbox but not yet a learning product.

### General-purpose platforms support CNG formats unevenly

**[Felt](https://www.felt.com/)** is a well-funded collaborative mapping platform ([$34.5M raised, including a $15M round in August 2025](https://pulse2.com/felt-15-million-secured-for-transforming-enterprise-gis/) led by Energize Capital). It has STAC browsing integration and AI-powered map building ("Felt AI"). [Pricing starts at $200/month for teams](https://www.felt.com/blog/introducing-the-new-team-plan). Felt is focused on enterprise GIS workflows, not CNG format education.

**[Kepler.gl](https://docs.kepler.gl/release-notes)** (open source, Foursquare/OpenJS Foundation) has the **strongest CNG format support among visual analysis tools**: [PMTiles (vector and raster), COG via STAC metadata, STAC Items/Collections, GeoArrow/GeoParquet, and FlatGeobuf](https://docs.kepler.gl/docs/user-guides/c-types-of-layers). Its 3.x release added DuckDB in-browser integration and an AI assistant. However, COG/STAC requires setting up an external tile server, and it is purely an analysis tool with no educational content or sandbox capabilities.

**[Foursquare Studio](https://docs.foursquare.com/analytics-products/docs/vector-tiles-create)** (formerly Unfolded.ai) offers the **strongest commercial CNG format support**: [COG via STAC, PMTiles upload/download, FlatGeobuf, and GeoArrow/GeoParquet with band math raster tile layer](https://foursquare.com/resources/blog/data/analysis-ready-raster-data/). Its weakness is that users consume formats without understanding them — it's an analytics tool, not a learning environment.

**[CARTO](https://carto.com/blog/what-being-cloud-native-should-really-mean-spatial-data)** (carto.com, ~$61M raised) is cloud-native in the data-warehouse sense (pushing computation to BigQuery, Snowflake, Databricks) but does not directly consume CNG file formats. Notably, CARTO is a **founding member of the CNG community** alongside Planet, Radiant Earth, and Development Seed. **ArcGIS Online** has very limited CNG support — [COGs are not natively supported](https://community.esri.com/t5/arcgis-pro-ideas/support-cloud-optimized-geotiff-cog-across-the/idi-p/938786) in the web platform, [STAC only works in ArcGIS Pro 3.2+ (desktop)](https://community.esri.com/t5/arcgis-pro-ideas/support-adding-cloud-optimized-geotiffs-by-url-in/idi-p/1249605), and PMTiles is absent entirely. **Mapbox Studio** uses proprietary tileset formats and has no native COG, STAC, or PMTiles support.

**Observable** (observablehq.com) is the most interesting general-purpose competitor. Its JavaScript reactive notebook paradigm supports MapLibre GL JS with PMTiles, geotiff.js for COGs, deck.gl integrations, and STAC via JS libraries. It is excellent for prototyping and has a rich community of geospatial notebooks. Pricing is freemium ($12/month for private notebooks). Its weakness is that it is general-purpose — no guided CNG learning paths, no built-in format loaders or inspectors, and scattered community examples require significant JavaScript knowledge.

**Jupyter + [leafmap](https://github.com/opengeos/leafmap)** represents the closest existing experience to what CNG Sandbox proposes. Leafmap (by Qiusheng Wu, CNG editorial board member) provides one-liner COG visualization, STAC catalog browsing and layer display, PMTiles support via MapLibre backend, and [Zarr visualization via titiler-xarray integration](https://leafmap.org/notebooks/111_zarr/). It has **100+ tutorial notebooks** and runs on Google Colab with no setup. However, it requires Python knowledge, operates within the notebook paradigm rather than a dedicated sandbox UI, and cannot inspect internal format structures.

[Low-code/no-code builders](https://www.esri.com/en-us/arcgis/products/app-builders/overview) (Esri Experience Builder, Google Maps Quick Builder, NoCodeMapApp) have **zero CNG format awareness** and serve fundamentally different use cases.

### Developer tools reveal the sandbox-shaped gap

The [MapLibre ecosystem](https://github.com/maplibre/awesome-maplibre) includes Maputnik (visual style editor), Mapforge (collaborative vector editor), and [native PMTiles protocol support](https://maplibre.org/maplibre-gl-js/docs/plugins/). **[maplibre-cog-protocol](https://cogeo.org/)** enables client-side COG rendering without a tile server. No MapLibre-based visual builder or learning sandbox exists.

**[GeoSandbox](https://joeyklee.github.io/geosandbox/)** is the only identified geospatial code playground — a collection of browser-based editors for Leaflet.js, Turf.js, MapboxGL.js, DeckGL.js, and D3-Geo. Created during a 2016 Mozilla Science Fellowship, it has been **inactive for a decade** and has zero CNG format support.

The Zarr visualization ecosystem is nascent. [NASA-IMPACT's Zarr Visualization Report](https://nasa-impact.github.io/zarr-visualization-report/) documents two approaches — dynamic tile servers (titiler-xarray) and direct client-side rendering — but notes that no tools existed to visualize Zarr in the browser when Zarr gained popularity, and [conventional chunk sizes (~100MB) are too large for browsers without re-chunking](https://zenodo.org/records/10407023). **[zarr-cesium](https://github.com/NOC-OI/zarr-cesium)** (NOC-OI) provides CesiumJS-based Zarr rendering for environmental science. Browser-native Zarr tools remain early-stage.

### Capability comparison matrix

| Capability | CNG Sandbox (proposed) | Planetary Computer | GEE | Kepler.gl | Foursquare Studio | Observable | Leafmap/Jupyter |
|---|---|---|---|---|---|---|---|
| Browser-based, no setup | ✅ | Partial | ✅ | ✅ | ✅ | ✅ | ⚠️ (Colab) |
| Interactive coding | ✅ | ✅ (Jupyter) | ✅ | ❌ | ❌ | ✅ | ✅ |
| COG support | ✅ | ✅ | ⚠️ GCS only | ⚠️ Needs TiTiler | ✅ | ⚠️ Manual | ✅ |
| STAC support | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ Manual | ✅ |
| PMTiles support | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Zarr support | ✅ | Limited | ⚠️ New | ❌ | ❌ | ❌ | ✅ |
| CNG-focused learning | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Partial |
| Format inspection | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Vendor-neutral | ✅ | ❌ (Azure) | ❌ (Google) | ✅ | ❌ (Foursquare) | ✅ | ✅ |

---

## PART 2: User Demand and Pain Points

### Education was declared the community's top priority

At the **[CNG Conference 2025](https://2025-ut.cloudnativegeo.org/agenda/)** (Snowbird, Utah), a facilitated discussion with **250+ practitioners** from NASA, Google, DuckDB Labs, NVIDIA, AWS, Microsoft, Planet, OGC, and others [identified education as the #1 community challenge](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025). The conference response was immediate: formation of the **CNG Education Working Group** (github.com/cng-education), launch of [thriveGEO's CNG 101 course](https://thrivegeo.com/cloud-native-geospatial-101/), and introduction of [CNG Badges](https://cloudnativegeo.org/blog/2025/05/introducing-cng-badges-beta) for verifiable digital credentials.

The conference dedicated an entire track to **"On-Ramp to Cloud-Native Geo"** — explicitly recognizing that transition from traditional GIS requires structured support. Remarkably, **45% of attendees were senior technical professionals** already working with geospatial data who still needed CNG transition guidance. An [attendee summarized](https://www.avineon-tensing.com/en-gb/blog-articles/cloud-native-geospatial-revolution): "This isn't about learning entirely new concepts but rather understanding how familiar geospatial principles apply in cloud-native environments."

### Developers are creating their own stopgap learning resources

The absence of an official learning sandbox has prompted community members to fill gaps themselves. In **[TiTiler GitHub Discussion #1113](https://github.com/developmentseed/titiler/discussions/1113)**, a community member created a "Getting Started with Titiler: A Beginner's Quickstart Guide" because existing documentation was insufficient for newcomers — the guide was welcomed for integration into official docs, confirming the onboarding gap. On Medium, [Cameron Kruse published a tutorial](https://medium.com/fika-blog/cloudy-with-a-chance-of-data-a-cloud-native-geospatial-tutorial-0eb79043c14c) titled with the revealing framing: "This is the guide I wish I had" — describing six months of struggle to understand which cloud platform, formats, and access patterns to use for geospatial data.

At a STAC Community Meetup, Tyler Erickson of Google asked: **"How do I navigate the STAC ecosystem?"** This prompted [GitHub Discussion #1328](https://github.com/radiantearth/stac-spec/discussions/1328) in the stac-spec repo about creating a STAC ratings system to evaluate API quality, reflecting frustration with inconsistent implementations. Another user in [Discussion #1169](https://github.com/radiantearth/stac-spec/discussions/1169) about forecast data described STAC terminology as "incredibly confusing and very easy to mess up."

### Setup complexity is a persistent barrier

[eoAPI deployment](https://eoapi.dev/intro/) requires Docker Compose with multiple services (STAC API, raster tiler, vector tiles, PostGIS/pgSTAC), knowledge of PostgreSQL, Docker, and [AWS CDK for cloud deployment](https://github.com/developmentseed/eoapi-template), plus multiple environment variables, S3 credentials, and GDAL configuration. For a newcomer wanting to experiment with CNG concepts, this represents hours of setup before seeing any results.

An [Element 84 blog post titled "A Software Engineer's First Experience with Geospatial"](https://element84.com/cloud-architecture/cloud-computing/a-software-engineers-first-experience-with-geospatial-data-tooling-and-stac) documented a generalist engineer's barriers: finding and accessing data across different webapps, portals, and data stores was described as a major challenge, with large data sizes making local development impractical.

Enterprise migration pain points mirror individual developer struggles. A [global reinsurer case study (via Axis Spatial)](https://www.axisspatial.com/blog/cloud-native-formats) reported that a single country-level risk assessment required downloading 47GB of data to extract features from a 2km² area, with the workflow taking 3-4 weeks. The same source noted that enterprise CNG migration typically takes 6-12 months and that desktop GIS users often perceive less benefit from CNG — underscoring the need for compelling demonstrations and sandboxes.

### Conference and industry signals confirm growing demand

[FOSS4G conferences](https://talks.osgeo.org/foss4g-2023/talk/XBHYF9/) from 2023 to 2025 have featured an escalating volume of CNG workshops and talks. At **[FOSS4G 2024](https://talks.osgeo.org/foss4g-2024-workshop/speaker/8TAMEN/)** (Belém), Jarrett Keifer led "Deep Dive into Cloud-Native Geospatial Raster Formats," emphasizing the importance of understanding how cloud-native formats actually store data as the industry shifts to range-request access patterns. At **[FOSS4G SOTM Oceania 2024](https://talks.osgeo.org/foss4g-sotm-oceania-2024/talk/ULSWMQ/)**, a workshop on "Cloud Native Geospatial for Earth Observation" explicitly aimed to bridge the gap for EO professionals who have not yet had the opportunity to apply these innovations.

A MOOC presented at **[FOSS4G Europe 2024](https://talks.osgeo.org/foss4g-europe-2024/talk/VE9UWX/)** ("Cubes and Clouds") stated unambiguously that no learning resource was available combining cloud native computing and open science in EO.

**[SatSummit 2024](https://satsummit.io/2024-washington/speakers/alex-leith/)** (Washington DC) sold separate **"Cloud Native EO Training Only" tickets** — a direct willingness-to-pay signal for CNG education. The CNG Conference 2025 similarly offered paid workshops on cloud-native raster formats and Zarr. [NASA-IMPACT's Zarr Visualization Report](https://zenodo.org/records/10407023) documented explicit demand for browser-based Zarr tools.

### Government adoption creates downstream training demand

[NASA has declared STAC an approved ESDIS convention](https://wiki.earthdata.nasa.gov/spaces/CMR/pages/252019491/EOSDIS+cloud+evolution+and+STAC): STAC is described as an essential component of the ESDIS cloud evolution strategy. [NASA's CMR provides STAC API](https://nasa-openscapes.github.io/earthdata-cloud-cookbook/in-development/CMR-STAC-Search.html) for all cloud-based holdings, and [NASA is migrating all Earth science data sites into Earthdata](https://www.earthdata.nasa.gov/) by end of 2026.

The **[Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/news/2025-2-13-release-new-cdse-stac-catalogue)** (ESA) launched a new STAC catalogue in February 2025 built on DevSeed's pgSTAC backend. [ESA hosted a dedicated STAC Workshop](https://eoframework.esa.int/download/attachments/58130435/20250416_CDSE_STAC_ESA_workshop.pdf?api=v2) in April 2025. [STAC's adoption was driven by the original 14 organizations at the first sprint in 2017](https://element84.com/geospatial/stac-a-retrospective-part-1/), and it has since been adopted as [OGC Community Standard v1.1.0](https://github.com/radiantearth/stac-spec/releases/tag/v1.1.0) (September 2025).

Each government mandate for STAC creates a wave of professionals who need to learn CNG technologies — and currently have no interactive sandbox to do so.

### The emerging paid training market validates willingness to pay

**[thriveGEO](https://thrivegeo.com/cloud-native-geospatial-101/)** launched as the first dedicated CNG training company with a 2-week cohort course (CNG 101) covering STAC, COG, Zarr, GeoParquet, xarray, and Dask. **[Spatial Thoughts](https://courses.spatialthoughts.com/qgis-cloud-native-geospatial.html)** (founded by [Ujaval Gandhi](https://spatialthoughts.com/2025/09/21/geo-for-good-2025/)) offers a free QGIS-based CNG workshop used by **1M+ people/year from 150+ countries** — demonstrating enormous latent demand for CNG education.

The [CNG Forum](https://cloudnativegeo.org/join/) itself operates a tiered membership model ($20/year for students to $5,000/year for commercial organizations), with **8,000+ newsletter subscribers, 400+ Slack members, and [25+ organizational members](https://cloudnativegeo.org/blog/2024/09/introducing-cng/)** including AWS, Google, Esri, NASA, and Development Seed. AWS offered **[$650,000 in credits](https://thrivegeo.com/genai-geospatial-challenge/)** for a Generative AI for Geospatial Challenge co-organized with thriveGEO, signaling major cloud provider investment in the CNG skill-building ecosystem.

---

## PART 3: Gap Analysis and Positioning

### The market gap is unambiguous

After exhaustive research across CNG-specific tools, general-purpose platforms, developer tools, and learning environments, the finding is clear: **no existing product combines an interactive browser-based sandbox, deep CNG format support (COG, STAC, PMTiles, Zarr), interactive coding, and structured learning paths.** The three closest competitors each cover only part of the value proposition:

- **Leafmap + Jupyter** offers excellent CNG format support and 100+ tutorials but requires Python knowledge, a Jupyter server, and cannot inspect format internals (COG overview structures, STAC schema validation, PMTiles tile indexing)
- **[Kepler.gl](https://docs.kepler.gl/docs/user-guides/c-types-of-layers)** provides strong browser-based CNG format visualization but has no educational content, requires external TiTiler for raster data, and is an analysis tool rather than a learning sandbox
- **Observable** offers excellent browser-based prototyping with reactive notebooks but is general-purpose, requires JavaScript expertise, and has no guided CNG content

Every CNG-specific tool (STAC Browser, COG Explorer, pmtiles.io, TiTiler viewer) addresses a single format in a single mode (viewing). Every general-purpose platform (Felt, CARTO, Foursquare Studio) consumes CNG formats transparently without exposing how they work. Every cloud platform (Planetary Computer, GEE) locks users into a vendor ecosystem. The proposed CNG Sandbox would occupy a currently empty intersection.

### DevSeed's "built by the makers" advantage is substantial and defensible

Development Seed authored or maintains **[TiTiler](https://github.com/developmentseed/titiler/blob/main/README.md)** (~1,000 stars, 63+ contributors), **[eoAPI](https://github.com/developmentseed/eoAPI)** (~290 stars, [powering NASA and Microsoft](https://developmentseed.org/blog/2023-07-17-say-hello-eoapi/)), **rio-tiler** (the core raster reading library), **rio-cogeo** (COG creation/validation), **cogeo-mosaic**, **tipg**, **morecantile**, and contributes significantly to **stac-fastapi**, **pgSTAC**, and the [STAC specification itself](https://element84.com/geospatial/stac-a-retrospective-part-1/). DevSeed was one of the original 14 organizations at the first STAC sprint in 2017 and celebrated [STAC's adoption as OGC Community Standard v1.1.0](https://github.com/radiantearth/stac-spec/releases/tag/v1.1.0) (September 2025).

This provenance creates three distinct advantages. First, **technical depth**: DevSeed understands the internals of every CNG format and tool at a level no competitor can match, enabling a sandbox that teaches not just usage but architecture and design principles. Second, **integration authority**: a sandbox built by the eoAPI/TiTiler team can provide seamless, authoritative integration with these tools rather than wrapping third-party APIs. Third, **community trust**: the CNG community already relies on DevSeed's tools daily — a sandbox from the same team carries implicit endorsement that cannot be purchased. DevSeed's recent R&D (**["Groundwork" program](https://developmentseed.org/blog/2026-02-10-groundwork-04/)**) has produced **deck.gl-raster** (client-side COG rendering), **[stac-map](https://developmentseed.org/blog/2025-09-02-stacmap/)** (DuckDB-powered STAC browser), and **stac-react** (React STAC components) — precisely the building blocks for a sandbox product.

### Competitive risks are moderate and manageable

**No well-funded startup is directly targeting this space.** Element 84 focuses on data pipelines and government contracts. Wherobots ($5.5M seed) is building spatial SQL analytics, not CNG education. [Felt ($34.5M raised)](https://pulse2.com/felt-15-million-secured-for-transforming-enterprise-gis/) is pursuing enterprise collaborative GIS. CARTO ($61M raised) works at the data warehouse layer. No YC or accelerator company was found targeting CNG developer tools specifically.

The primary risk is from **adjacent platform expansion**. Microsoft could add learning features to Planetary Computer. Google could integrate CNG formats into Earth Engine's Code Editor. [Esri has been slow to adopt open standards](https://community.esri.com/t5/arcgis-pro-ideas/support-cloud-optimized-geotiff-cog-across-the/idi-p/938786) (years of community requests for COG support show limited progress), and none has the authentic "built by the community, for the community" positioning.

A secondary risk is that the community may expect **free open-source tools** rather than a paid product. DevSeed's entire ecosystem is MIT-licensed, and the [CNG ethos emphasizes openness](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025). Mitigation strategies include a generous free tier, paid tiers for teams/enterprises, and potentially maintaining the sandbox's learning components as open source while charging for hosted infrastructure and enterprise features.

### Market sizing suggests a viable but niche opportunity

The CNG developer community can be estimated through several proxies. **[pystac](https://snyk.io/advisor/python/pystac)** has approximately **500,000+ monthly PyPI downloads** and ~115,800 weekly downloads, suggesting **10,000–20,000 active CNG developers**. The broader CNG-aware community is estimated at **30,000–50,000 people**. The CNG Forum has 8,000+ newsletter subscribers and 6,000+ social media followers.

This community is **growing rapidly**. [Element 84's 2025 Geospatial Tech Radar](https://element84.com/company/the-2025-geospatial-tech-radar-agentic-ai-eo-embeddings-and-cloud-native-maturity/) removed "Cloud-Native Geospatial" as its own category because it is now so foundational that it is simply the default operational context. COG, STAC, PMTiles, and GeoParquet all reached "Adopt" tier. [QGIS added native STAC support](https://talks.osgeo.org/qgis-uc2024/talk/9HPZUQ/), bringing CNG to the world's most widely used open-source GIS. [Planet's crawl found 120 million+ STAC items](https://developers.planet.com/blog/2022/Aug/31/state-of-stac/) across 4,000+ collections with 550 million+ assets. Government mandates (NASA ESDIS, Copernicus CDSE, USGS Landsat) and enterprise adoption are creating sustained downstream demand.

The broader [geospatial analytics market](https://www.grandviewresearch.com/industry-analysis/geospatial-analytics-market) provides context: **[$85–114 billion in 2024](https://www.marketsandmarkets.com/Market-Reports/geospatial-analytics-market-198354497.html)**, growing at **[11–13% CAGR](https://www.giiresearch.com/report/moi1849868-geospatial-analytics-market-share-analysis.html)** to $175–227 billion by 2030. The services segment is growing fastest at **[12.9% CAGR](https://www.kenresearch.com/industry-reports/usa-geospatial-analytics-market)**, driven by a widening skills gap as organizations adopt increasingly complex spatial solutions.

### Strategic positioning recommendations

The evidence points toward a **freemium model with distinct user segments**:

- **Individual learners** (free tier): Guided learning paths for COG, STAC, PMTiles, Zarr. Interactive format inspection. Code playground with pre-configured examples. This tier builds community adoption and funnel.
- **Professional prototypers** (paid tier): Connect to custom STAC APIs, load private data, build and export map applications, collaborate with team members. Target audience: the **45% of CNG Conference attendees** who are senior professionals needing structured CNG transition support.
- **Enterprise/government** (premium tier): Custom deployments, integration with organizational data infrastructure, team management, training dashboards and certification tracking (leverage CNG Badges). Target: NASA, ESA, NOAA, and enterprise adopters building CNG infrastructure.

The product should emphasize its **[vendor-neutral positioning](https://cloudnativegeo.org/blog/2024/09/introducing-cng/)** — a critical differentiator against Planetary Computer (Azure-locked) and GEE (Google-locked). The CNG community explicitly [values vendor-agnostic resources](https://cloudnativegeo.org/join/).

### Five factors that make this opportunity compelling

**First**, the timing is right. CNG has crossed from early-adopter to early-majority, with government mandates and enterprise adoption creating waves of new users who need onboarding. [Element 84's assessment](https://element84.com/company/the-2025-geospatial-tech-radar-agentic-ai-eo-embeddings-and-cloud-native-maturity/) that CNG is now "the default operational context" means the learning need is structural.

**Second**, the [education gap is officially recognized](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025). The CNG community itself has declared education their top priority and is actively building infrastructure (Education Working Group, Badges, thriveGEO partnership) to address it.

**Third**, the "built by the makers" narrative is uniquely powerful. In developer tools, provenance matters enormously. When the team that [created TiTiler](https://github.com/developmentseed/titiler/blob/main/README.md) builds a sandbox that teaches TiTiler, that carries a credibility signal equivalent to millions in marketing spend.

**Fourth**, the competitive window is open. No well-funded competitor is targeting this specific intersection. But the window may not stay open indefinitely — as the CNG market matures, platform players will add more user-friendly onramps to their proprietary ecosystems.

**Fifth**, DevSeed already has the building blocks. [deck.gl-raster](https://developmentseed.org/blog/2026-02-10-groundwork-04/) for client-side COG rendering, [stac-map](https://developmentseed.org/blog/2025-09-02-stacmap/) for DuckDB-powered STAC exploration, stac-react for UI components, and the [entire eoAPI/TiTiler backend](https://developmentseed.org/blog/2023-07-17-say-hello-eoapi/) — these are the components of a sandbox. The engineering lift is incremental product development, not fundamental R&D.

---

## Conclusion

The CNG Sandbox opportunity sits at the convergence of a clear market gap, strong community demand, favorable timing, and DevSeed's unique technical positioning. The geospatial industry is undergoing a generational shift from desktop-file-based workflows to cloud-native formats, and the tooling to help practitioners make that transition does not yet exist in interactive, browser-native form. DevSeed's risk is not competition — it is execution. The company must navigate the transition from services to product, price the sandbox appropriately for a community that values open source, and ship before the window of uncontested positioning closes. The demand signals — from [NASA mandates](https://wiki.earthdata.nasa.gov/spaces/CMR/pages/252019491/EOSDIS+cloud+evolution+and+STAC) to [CNG Conference priorities](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025) to community members writing "[the guide I wish I had](https://medium.com/fika-blog/cloudy-with-a-chance-of-data-a-cloud-native-geospatial-tutorial-0eb79043c14c)" — are as strong as one could hope for in an emerging market.

---

## Source Index

All URLs referenced in this document, organized by section:

### Market & Industry Reports
- [Geospatial Analytics Market (Grand View Research)](https://www.grandviewresearch.com/industry-analysis/geospatial-analytics-market)
- [Geospatial Analytics Market (MarketsandMarkets)](https://www.marketsandmarkets.com/Market-Reports/geospatial-analytics-market-198354497.html)
- [Geospatial Analytics Market (GII Research / Mordor Intelligence)](https://www.giiresearch.com/report/moi1849868-geospatial-analytics-market-share-analysis.html)
- [Geospatial Analytics Market (Allied Market Research)](https://www.alliedmarketresearch.com/geospatial-analytics-market)
- [USA Geospatial Analytics Market (Ken Research)](https://www.kenresearch.com/industry-reports/usa-geospatial-analytics-market)

### CNG Community & Standards
- [STAC Specification (About)](https://stacspec.org/en/about/)
- [STAC v1.1.0 OGC Community Standard Release](https://github.com/radiantearth/stac-spec/releases/tag/v1.1.0)
- [State of STAC (Planet, 2022)](https://developers.planet.com/blog/2022/Aug/31/state-of-stac/)
- [Planet and Cloud-Native Geospatial](https://developers.planet.com/blog/2022/May/26/planet-and-cloud-native-geospatial/)
- [STAC: A Retrospective, Part 1 (Element 84)](https://element84.com/geospatial/stac-a-retrospective-part-1/)
- [Introducing CNG (CNG Forum)](https://cloudnativegeo.org/blog/2024/09/introducing-cng/)
- [Join CNG / Membership](https://cloudnativegeo.org/join/)
- [Challenges for the CNG Community - 2025](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025)
- [CNG Badges (Beta)](https://cloudnativegeo.org/blog/2025/05/introducing-cng-badges-beta)
- [CNG Conference 2025 Agenda](https://2025-ut.cloudnativegeo.org/agenda/)
- [CNG Conference Schedule](https://schedule.cloudnativegeo.org/)
- [Cloud Optimized GeoTIFF (cogeo.org)](https://cogeo.org/)

### DevSeed Tools & Blog Posts
- [eoAPI GitHub](https://github.com/developmentseed/eoAPI)
- [Introducing eoAPI (Blog)](https://developmentseed.org/blog/2023-07-17-say-hello-eoapi/)
- [What's New in eoAPI (Blog)](https://developmentseed.org/blog/2025-06-18-eoapi/)
- [eoAPI Documentation](https://eoapi.dev/intro/)
- [eoAPI Project Page](https://developmentseed.org/projects/eoapi/)
- [eoAPI Template (AWS CDK)](https://github.com/developmentseed/eoapi-template)
- [TiTiler GitHub / README](https://github.com/developmentseed/titiler/blob/main/README.md)
- [TiTiler Discussion #1113 (Beginner's Guide)](https://github.com/developmentseed/titiler/discussions/1113)
- [stac-map Blog Post](https://developmentseed.org/blog/2025-09-02-stacmap/)
- [Right-sizing STAC (stac-geoparquet)](https://developmentseed.org/blog/2025-05-07-stac-geoparquet/)
- [Groundwork 04 (R&D)](https://developmentseed.org/blog/2026-02-10-groundwork-04/)
- [Development Seed Company Page](https://developmentseed.org/company/)
- [Development Seed on LinkedIn (eoAPI)](https://www.linkedin.com/posts/development-seed_eoapi-geospatial-stac-activity-7087808392844492800-HAVJ)

### Competitors & Platforms
- [STAC Browser GitHub](https://github.com/radiantearth/stac-browser)
- [Planetary Computer Pro (Ingestion)](https://learn.microsoft.com/en-us/azure/planetary-computer/ingestion-overview)
- [Planetary Computer STAC Overview](https://learn.microsoft.com/en-us/azure/planetary-computer/stac-overview)
- [How Microsoft's Planetary Computer Uses STAC (Element 84)](https://element84.com/geospatial/how-microsofts-planetary-computer-uses-stac/)
- [Google Earth Engine Code Editor](https://developers.google.com/earth-engine/guides/playground)
- [COGs in GEE (geemap)](https://geemap.org/notebooks/38_cloud_geotiff/)
- [Earth Search GitHub (Element 84)](https://github.com/Element84/earth-search)
- [Earth Search Console (Element 84)](https://element84.com/design/ui-ux/introducing-earth-search-console-an-aws-open-data-exploration-ui)
- [FilmDrop (Element 84)](https://element84.com/filmdrop/)
- [Element 84 Homepage](https://element84.com/)
- [Felt Funding ($15M)](https://pulse2.com/felt-15-million-secured-for-transforming-enterprise-gis/)
- [Felt Team Plan Pricing](https://www.felt.com/blog/introducing-the-new-team-plan)
- [Felt on PitchBook](https://pitchbook.com/profiles/company/469165-96)
- [Kepler.gl Release Notes](https://docs.kepler.gl/release-notes)
- [Kepler.gl Layer Types](https://docs.kepler.gl/docs/user-guides/c-types-of-layers)
- [Foursquare Studio Vector Tiles](https://docs.foursquare.com/analytics-products/docs/vector-tiles-create)
- [Foursquare Analysis-Ready Raster Data](https://foursquare.com/resources/blog/data/analysis-ready-raster-data/)
- [CARTO Cloud-Native Blog](https://carto.com/blog/what-being-cloud-native-should-really-mean-spatial-data)
- [Esri COG Support Request (Community)](https://community.esri.com/t5/arcgis-pro-ideas/support-cloud-optimized-geotiff-cog-across-the/idi-p/938786)
- [Esri COG by URL Request](https://community.esri.com/t5/arcgis-pro-ideas/support-adding-cloud-optimized-geotiffs-by-url-in/idi-p/1249605)
- [Esri App Builders](https://www.esri.com/en-us/arcgis/products/app-builders/overview)
- [Leafmap GitHub](https://github.com/opengeos/leafmap)
- [Leafmap Zarr Tutorial](https://leafmap.org/notebooks/111_zarr/)
- [COG Explorer](https://geotiffjs.github.io/cog-explorer/)
- [PMTiles Viewer (new pmtiles.io)](https://protomaps.com/blog/new-pmtiles-io/)
- [stac-utils GitHub Org](https://github.com/stac-utils)
- [Franklin STAC Server (Medium)](https://medium.com/radiant-earth-insights/azaveas-server-franklin-now-supports-the-latest-stac-api-2343437c72cd)
- [pystac Health (Snyk)](https://snyk.io/advisor/python/pystac)

### Developer Ecosystem
- [Awesome MapLibre](https://github.com/maplibre/awesome-maplibre)
- [MapLibre GL JS Plugins](https://maplibre.org/maplibre-gl-js/docs/plugins/)
- [GeoSandbox](https://joeyklee.github.io/geosandbox/)
- [Zarr Visualization Report (NASA-IMPACT)](https://nasa-impact.github.io/zarr-visualization-report/)
- [Next-Gen Zarr Web Map Visualization (Zenodo)](https://zenodo.org/records/10407023)
- [zarr-cesium GitHub](https://github.com/NOC-OI/zarr-cesium)

### User Demand & Pain Points
- [Cameron Kruse CNG Tutorial (Medium)](https://medium.com/fika-blog/cloudy-with-a-chance-of-data-a-cloud-native-geospatial-tutorial-0eb79043c14c)
- [STAC Ratings Discussion #1328](https://github.com/radiantearth/stac-spec/discussions/1328)
- [STAC Forecast Data Discussion #1169](https://github.com/radiantearth/stac-spec/discussions/1169)
- [Element 84: Engineer's First Geospatial Experience](https://element84.com/cloud-architecture/cloud-computing/a-software-engineers-first-experience-with-geospatial-data-tooling-and-stac)
- [Axis Spatial: CNG Enterprise Guide](https://www.axisspatial.com/blog/cloud-native-formats)
- [Avineon Tensing: CNG On-Ramp](https://www.avineon-tensing.com/en-gb/blog-articles/cloud-native-geospatial-revolution)

### Conferences & Training
- [FOSS4G 2023 CNG Overview Talk](https://talks.osgeo.org/foss4g-2023/talk/XBHYF9/)
- [FOSS4G 2024 Workshop (Jarrett Keifer)](https://talks.osgeo.org/foss4g-2024-workshop/speaker/8TAMEN/)
- [FOSS4G SOTM Oceania 2024 CNG Workshop](https://talks.osgeo.org/foss4g-sotm-oceania-2024/talk/ULSWMQ/)
- [FOSS4G Europe 2024 Cubes and Clouds MOOC](https://talks.osgeo.org/foss4g-europe-2024/talk/VE9UWX/)
- [QGIS User Conference 2024 CNG Talk](https://talks.osgeo.org/qgis-uc2024/talk/9HPZUQ/)
- [SatSummit 2024 (Alex Leith)](https://satsummit.io/2024-washington/speakers/alex-leith/)
- [Camptocamp CNG 2025 Recap](https://camptocamp.com/en/news-events/cng2025)
- [thriveGEO CNG 101](https://thrivegeo.com/cloud-native-geospatial-101/)
- [thriveGEO GenAI Geospatial Challenge](https://thrivegeo.com/genai-geospatial-challenge/)
- [Spatial Thoughts CNG Workshop](https://courses.spatialthoughts.com/qgis-cloud-native-geospatial.html)
- [Spatial Thoughts Geo for Good 2025](https://spatialthoughts.com/2025/09/21/geo-for-good-2025/)
- [2025 Geospatial Tech Radar (Element 84)](https://element84.com/company/the-2025-geospatial-tech-radar-agentic-ai-eo-embeddings-and-cloud-native-maturity/)

### Government & Institutional
- [NASA ESDIS STAC Convention](https://wiki.earthdata.nasa.gov/spaces/CMR/pages/252019491/EOSDIS+cloud+evolution+and+STAC)
- [NASA CMR-STAC Search Guide](https://nasa-openscapes.github.io/earthdata-cloud-cookbook/in-development/CMR-STAC-Search.html)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [Copernicus CDSE STAC Catalogue](https://dataspace.copernicus.eu/news/2025-2-13-release-new-cdse-stac-catalogue)
- [ESA STAC Workshop (PDF)](https://eoframework.esa.int/download/attachments/58130435/20250416_CDSE_STAC_ESA_workshop.pdf?api=v2)
- [Radiant Earth Homepage](https://radiant.earth/)
- [Radiant Earth: CNG Solutions Interview](https://radiant.earth/blog/2023/05/uncovering-the-power-of-cloud-native-geospatial-solutions-an-interview-with-aimee-barciauskas/)
- [University of Arizona CNG DataLab](https://ua-datalab.github.io/cloud-native-geospatial/)
