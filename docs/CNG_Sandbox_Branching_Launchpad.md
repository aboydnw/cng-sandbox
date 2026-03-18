# CNG Sandbox: The Branching Launchpad

## From "Learn CNG" to "Ship Something" — Processing Handoffs, Storymaps, and Multiple User Outcomes

*Product Concept Brief — March 2026*

---

## The Reframe

Our previous thinking positioned CNG Sandbox as a linear funnel: learn formats → convert data → deploy infrastructure. But real users don't follow a single path. A climate researcher wants to publish a scrollytelling narrative about sea level rise. A government analyst wants to catalog and share 500 Landsat exports. A startup founder wants to prototype a tile-serving architecture. These are fundamentally different outcomes that happen to share the same entry point: "I have geospatial data and I want to do something with it."

**CNG Sandbox should be a branching launchpad, not a linear pipeline.** The user arrives, explores their data, learns what CNG formats can do — and then the sandbox helps them choose and execute the path that matches their actual goal.

This brief addresses two connected questions:
1. **The processing handoff**: How do we get users from "transform a sample" to "transform all your data, on your own resources" — gracefully?
2. **The branching outcomes**: What are the distinct paths users can take, and how does the storymap path change the product's appeal?

---

## PART 1: The Processing Handoff

### The cliff we need to eliminate

Today the sandbox concept has a clean interactive experience for one file: upload → convert to COG → inspect → preview on map. The moment the user thinks "now do this to my other 499 files," they fall off a cliff. The sandbox can't batch-process hundreds of multi-GB files in a browser, and the user doesn't know how to run `rio-cogeo` in a loop on a VM.

The gap isn't just technical — it's conceptual. The user's mental model is still "download, process locally, upload somewhere." CNG's promise is "process once, serve from the cloud, never download again." The sandbox needs to bridge not just the tooling gap but the mindset gap.

### The recipe-builder pattern

The key insight: **the sandbox is where you design the transformation, not where you run it at scale.** Think of it as a recipe builder. The user experiments interactively with one file — choosing COG compression settings, overview levels, STAC metadata templates, output naming conventions, target bucket configuration. The sandbox records every decision. Then a "Scale this up" action produces a runnable artifact that applies the same transformation to a directory of files.

The sandbox's job is to make the recipe so clear and complete that running it elsewhere is trivial. The user doesn't need to understand `rio-cogeo` flags — the sandbox already translated their visual choices into the right CLI invocation.

### Where the batch job actually runs

The runnable artifact needs somewhere to execute. Options in order of accessibility:

**Option A: Google Colab notebook (recommended for v1).** This is the sweet spot for accessibility. Many target users — especially GEE refugees and academic researchers — already know Colab. The sandbox generates a self-contained notebook that:
- Connects to the user's source files (Google Drive, S3 bucket, or URL list)
- Runs the transformation pipeline (COG conversion via `rio-cogeo`, STAC metadata generation via `pystac`)
- Pushes results to the user's storage (R2, S3, or back to Drive)
- Produces a summary of what was processed

The user clicks "Open in Colab," authenticates to their data source, hits "Run All," and walks away. Colab provides free compute (with optional GPU), a familiar notebook environment, and no infrastructure to manage.

This is elegant because **the user's "own resources" are Google's free Colab tier.** They don't need an AWS account, a VM, or Docker. The computational cost to them is zero (within Colab's limits). For most datasets under 50–100 files, Colab's resources are sufficient.

**Option B: Local script.** For users comfortable with a terminal, the sandbox generates a Python script with a one-line install (`pip install rio-cogeo pystac`). This works for tens of files on a decent laptop but doesn't scale well to hundreds of large files. Useful as a fallback, not a primary path.

**Option C: Cloud VM / container (documented, not automated).** For serious batch processing (hundreds of files, multi-TB datasets), the user needs real compute. The sandbox can generate a cloud-init script or Dockerfile, but deploying it requires cloud account expertise. This is where the sandbox hands off to documentation or DevSeed consulting. Not a v1 feature.

### The Colab handoff UX

The handoff should feel like an export, not an eviction. Imagine:

1. User has been working interactively in the sandbox — they converted a sample file, liked the result, configured their STAC metadata template.
2. They click "Apply to all my files" and see a dialog: "You have 200 files to process. The sandbox processes one at a time — for bulk conversion, we'll generate a notebook you can run in Google Colab (free)."
3. The sandbox generates the notebook, pre-filled with their transformation settings, their source file location, and their output bucket.
4. User clicks "Open in Colab." The notebook opens with a clear markdown introduction explaining what it does.
5. User runs the notebook. Files are converted and pushed to their storage.
6. User returns to the sandbox, which can now browse their output bucket and show the results — the STAC catalog, the map preview, the deployment options.

The critical moment is step 6: **the sandbox stays in the loop.** The user isn't abandoned after the Colab run. They come back to the sandbox to verify, catalog, and deploy. This is the "workbench" pattern — prep in the sandbox, execute elsewhere, return to the sandbox to finish.

---

## PART 2: The Branching Launchpad

### Three paths, one entry point

After the user has explored their data in the sandbox (uploaded files, converted a sample, previewed on a map), the sandbox should present a clear "What do you want to do next?" moment with distinct paths:

### Path 1: "Tell a story" → Open-Source StoryMap Builder

**What the user wants:** A scrollytelling map experience they can publish and share — for a grant report, a research presentation, a public awareness campaign, or a journalism piece.

**What the sandbox provides:** A visual storymap builder that lets the user create chapters (map views + narrative text + media), arrange them in a scroll sequence, and publish as a static site. The map layers come from the CNG data they've already loaded in the sandbox — COGs, STAC items, PMTiles basemaps.

**Why this is a huge opportunity:** The open-source storymap landscape is fragmented and underwhelming. The main options are:

- **[Esri ArcGIS StoryMaps](https://storymaps.arcgis.com/)**: The dominant tool, but requires an ArcGIS Online account ($100+/year for Creator license), is locked into Esri's ecosystem, and has zero CNG format awareness. [G2 lists its alternatives as Adobe InDesign and Canva](https://www.g2.com/products/arcgis-storymaps/competitors/alternatives) — which tells you how poorly the competition is understood.
- **[Knight Lab StoryMapJS](https://www.allthatgeo.com/story-map-knight-lab/)**: Free, open-source, but [limited to point-based stories](https://guides.library.duke.edu/webmapping/story) with markers — no raster imagery, no COGs, no satellite data layers. Built for text journalists, not geospatial professionals.
- **[Mapbox Storytelling Template](https://github.com/mapbox/storytelling)**: Requires a Mapbox access token and Mapbox Studio for styling. Developer-focused — you're editing a `config.js` file, not using a visual builder.
- **[MapLibre Storymap (Digital Democracy)](https://github.com/digidem/maplibre-storymap)**: Open-source MapLibre fork of the Mapbox template. No proprietary dependencies, but still requires editing code. [Qiusheng Wu's maplibre-gl-storymaps](https://github.com/opengeos/maplibre-gl-storymaps) is a more recent open-source version with Scrollama integration.
- **[Scrollama.js](http://kiricarini.com/story-scrolly-mapping/)** + custom code: The library most newsrooms use for custom scrollytelling, but it's a building block, not a product.

**The gap:** No existing tool provides a visual (no-code) storymap builder that natively consumes CNG data sources (COGs, STAC items, PMTiles). A researcher with a time series of COGs from their STAC catalog should be able to build a scrollytelling narrative about land cover change without writing JavaScript.

**What we'd build:** A chapter-based visual editor inside the sandbox:
- Each chapter defines: a map view (center, zoom, bearing, pitch), visible layers (from the user's CNG data), narrative text, and optional media (images, charts)
- The user arranges chapters in a scroll sequence
- The sandbox generates a static site using MapLibre GL JS + Scrollama, with CNG data sources (COGs served from the user's R2 bucket, PMTiles basemap)
- One-click publish to Vercel or GitHub Pages

**Why this might be our strongest v1 output path:** It's the most immediately gratifying outcome — the user goes from files to a beautiful, shareable narrative in one session. It doesn't require batch processing (a storymap might use 3–5 carefully chosen map views, not 500 files). It doesn't require infrastructure (static site + COGs on object storage). And it serves a huge audience that currently depends on Esri StoryMaps — researchers, NGOs, journalists, educators — who would love a free, open-source, CNG-native alternative.

**Connection to the PRD:** The PRD already lists scrollytelling as a v2 feature. This brief argues for pulling it forward, possibly as a v1 output alongside the basic map viewer — because it makes the sandbox immediately productive for a large user segment that doesn't need batch processing or infrastructure deployment.

### Path 2: "Share my data" → Guided Catalog + Viewer Deployment

**What the user wants:** Colleagues, collaborators, or the public can discover and visualize their data via a URL. They need their data optimized, cataloged, and served.

**What the sandbox provides:** The Tier 0 deployment from the Guided Self-Hosting brief — COGs on R2, static STAC catalog, map viewer on Vercel. For users with many files, the processing handoff (Part 1 of this brief) runs first to batch-convert their data.

**Who it's for:** Data publishers, government agencies complying with open data mandates, research groups sharing outputs with collaborators.

**This is the path most likely to trigger the processing handoff.** A user sharing a single dataset might not need batch processing. A user sharing an entire archive will need the Colab notebook flow to convert and catalog everything before deploying.

### Path 3: "Build infrastructure" → Documentation + Consulting Lead

**What the user wants:** A production CNG stack — tile serving, dynamic STAC API, authentication, multi-user access. This is the full eoAPI deployment.

**What the sandbox provides:** Not infrastructure, but preparation. The sandbox validates their data, generates a pre-filled eoAPI config, provides a customized deployment guide, and offers a "try before you deploy" preview using static STAC + client-side rendering. The user can see what their eoAPI deployment will look like before committing to infrastructure.

**Who it's for:** Organizations building production geospatial platforms. This is where DevSeed consulting naturally plugs in — the sandbox generates the lead and de-risks the engagement by pre-validating the user's data and requirements.

---

## PART 3: How This Reshapes the Product

### The sandbox identity shift

Without branching paths:
> "CNG Sandbox is a learning tool for cloud-native geospatial formats."

With branching paths:
> "CNG Sandbox is where geospatial data becomes something you can share, publish, or build on — using open standards you own."

The first identity is educational. The second is productive. The storymap path is especially important for this shift because it produces something *emotionally compelling* — not just a tile server URL, but a narrative that tells a story. Researchers don't get excited about STAC catalogs. They get excited about showing their work in a way that moves people.

### The user journey, unified

Regardless of which path the user takes, the early sandbox experience is identical:

1. **Upload** — Bring your files (GeoTIFF, Shapefile, GeoJSON, whatever you have)
2. **Understand** — The sandbox inspects, validates, and explains what you have. "This is a GeoTIFF but not a COG — here's what that means and why it matters."
3. **Transform** — Convert to CNG formats interactively. See the before/after. Understand the tradeoffs.
4. **Preview** — See your data on a map. Add layers, adjust styling, explore.
5. **Choose your path:**
   - **"Tell a story"** → Storymap builder → Publish
   - **"Share my data"** → Catalog + deploy wizard → (batch processing if needed) → Publish
   - **"Build infrastructure"** → Config generator + deployment guide → DevSeed consulting

Steps 1–4 are the sandbox's core, and they're the same for everyone. Step 5 is where the product becomes a launchpad.

### What this means for the processing handoff

The processing handoff (Part 1) plugs into Path 2 and Path 3 — the paths where users have many files. For Path 1 (storymap), batch processing is rarely needed because a scrollytelling narrative typically uses a handful of carefully chosen views, not hundreds of files. This means:

- **Path 1 can ship without the Colab integration.** A storymap builder that works with files already in the sandbox is self-contained.
- **Path 2 needs the processing handoff for users with many files.** The Colab notebook flow is essential here.
- **Path 3 defers processing to the user's own infrastructure** — the sandbox generates the recipe, the user runs it in their eoAPI deployment pipeline.

This suggests a phased build: **v1 ships Path 1 (storymap) + basic Path 2 (single-dataset deploy). v1.5 adds the Colab processing handoff for multi-file Path 2. v2 adds Path 3 (eoAPI config generation).**

---

## PART 4: The StoryMap Competitive Angle

### Why an open-source, CNG-native storymap builder matters

The [Esri StoryMaps ecosystem](https://storymaps.arcgis.com/) is enormous — it's one of Esri's most visible consumer-facing products, used by thousands of organizations for public communication. But it has fundamental limitations for the CNG community:

- **Vendor lock-in**: Requires an ArcGIS Online subscription. The storymap lives on Esri's infrastructure. If you stop paying, your story disappears.
- **No CNG format support**: Cannot consume COGs from S3, cannot query STAC catalogs, cannot render PMTiles basemaps. You must upload data into Esri's proprietary format.
- **No self-hosting**: You cannot export an Esri StoryMap as a static site and host it yourself.
- **Cost**: Creator license starts at $100/year per named user. Organizations with many story authors face significant licensing costs.

The open-source alternatives ([StoryMapJS](https://storymap.knightlab.com/), [maplibre-storymap](https://github.com/digidem/maplibre-storymap), [maplibre-gl-storymaps](https://github.com/opengeos/maplibre-gl-storymaps)) solve the cost and self-hosting problems but require editing code — JSON config files, JavaScript, HTML. There is no visual builder for open-source scrollytelling maps that a non-developer can use. People regularly [ask for one on forums](https://community.openstreetmap.org/t/open-source-story-maps-do-you-know-other-than-arcgis-storymaps/119508).

**CNG Sandbox's storymap builder would be the first tool that combines:**
- Visual (no-code) chapter editing with map view configuration
- Native CNG data source support (COGs from any URL, STAC layer selection, PMTiles basemaps)
- Static site export (self-hostable, no vendor dependency)
- Free — the user pays nothing to DevSeed, only hosting costs (which can be zero on Vercel/GitHub Pages free tiers)

### The narrative for different audiences

**For researchers:** "Turn your satellite analysis into a compelling narrative. Upload your COGs, build a scrolling story about land cover change, and publish it to share with funders, journals, or the public — free, open-source, and self-hosted."

**For NGOs and journalists:** "Tell environmental stories with your own data. No ArcGIS license needed. No vendor lock-in. Your story lives on your infrastructure, not someone else's."

**For the CNG community:** "This is what CNG formats are for — not just tile serving and API endpoints, but beautiful, shareable stories built on open standards. The same COGs that power NASA VEDA can power your next grant presentation."

**For GEE refugees:** "You exported your analysis from Earth Engine. Now turn it into something people will actually look at — a scrollytelling map you can share with a URL, hosted for free, built on the same open formats the rest of the industry is adopting."

---

## Open Questions

**How much of the storymap builder is new engineering vs. integration?** The [maplibre-gl-storymaps](https://github.com/opengeos/maplibre-gl-storymaps) template provides the rendering engine (MapLibre + Scrollama). The sandbox would need to build a visual chapter editor on top of this — a GUI for defining map views, writing narrative text, arranging chapters, and configuring layer visibility. This is meaningful frontend work but well within DevSeed's capabilities.

**Should the storymap builder support CNG-specific features that Esri can't match?** For example: a time-slider chapter that scrubs through a temporal stack of COGs (STAC-powered), or a comparison chapter that swipes between two COG layers. These would be unique differentiators that leverage CNG formats in ways Esri StoryMaps cannot.

**What's the relationship between the storymap builder and the map app builder in the PRD?** The PRD describes a visual map application builder. A storymap builder is a specific *type* of map application. We could build the storymap builder as a template/mode within the broader map builder, or as a standalone tool. The template approach is probably more architecturally sound — the map builder is the engine, storymaps are one output format alongside dashboards, explorers, and simple viewers.

**Should storymaps be the hero feature for launch?** A storymap demo is inherently more shareable and impressive than a STAC catalog or a tile server URL. It's the kind of output that gets retweeted, embedded in blog posts, and shown at conferences. If we want CNG Sandbox to have viral distribution potential, leading with storymaps might be strategically smarter than leading with format conversion — even though format conversion is the deeper technical value.

**How does the processing handoff interact with the storymap path?** For most storymaps, the user has a small number of pre-prepared map layers — they don't need to batch-convert 500 files. But for time-series storymaps (showing change over time), they might need a processed stack of COGs from a STAC query. The processing handoff could generate a notebook that creates the exact temporal stack needed for the storymap chapters.

---

## Summary: The Three Documents Together

This brief, combined with the Guided Self-Hosting brief and the GEE Migration Opportunity brief, describes a unified product vision:

1. **GEE Migration doc**: Identifies the audience and their pain points. GEE users arrive with exported files and no idea what to do next. The opportunity is a marketing/content angle with targeted product accommodations.

2. **Guided Self-Hosting doc**: Describes the deployment spectrum — from static files on R2 (Tier 0) to full eoAPI (Tier 2). Establishes that the sandbox is a workbench and launchpad, not a hosting service. The user owns everything.

3. **This doc (Branching Launchpad)**: Reframes the sandbox as a multi-path tool with three distinct outcomes — storymaps, data sharing, and infrastructure building. Introduces the processing handoff pattern (Colab notebooks) for batch operations. Argues that the storymap path is the most immediately compelling and should be prioritized.

Together, these three documents describe a product that:
- **Teaches** CNG formats through interactive exploration (core sandbox)
- **Transforms** data from legacy formats to CNG (conversion + batch processing handoff)
- **Publishes** results as storymaps, catalogs, or map viewers (branching outputs)
- **Deploys** on the user's own infrastructure (guided self-hosting)
- **Captures** GEE refugees through targeted content and accommodations (marketing angle)

The sandbox isn't just educational. It's the place where geospatial data becomes something you can share with the world — using open standards, on infrastructure you own, without needing an engineer.

---

## Source Index

### Open-Source Storymap Tools
- [MapLibre Storymap (Digital Democracy)](https://github.com/digidem/maplibre-storymap)
- [maplibre-gl-storymaps (Qiusheng Wu / opengeos)](https://github.com/opengeos/maplibre-gl-storymaps)
- [Mapbox Storytelling Template](https://github.com/mapbox/storytelling)
- [Mapbox: How to Build a Scrollytelling Map](https://www.mapbox.com/blog/how-to-build-a-scrollytelling-map)
- [Knight Lab StoryMapJS](https://www.allthatgeo.com/story-map-knight-lab/)
- [Scrollama.js and story-scrolly-mapping resource list](http://kiricarini.com/story-scrolly-mapping/)
- [story-scrolly-mapping GitHub (kcarini)](https://github.com/kcarini/story-scrolly-mapping)
- [Open Source Story Maps? (OpenStreetMap Forum)](https://community.openstreetmap.org/t/open-source-story-maps-do-you-know-other-than-arcgis-storymaps/119508)
- [Open-source ESRI Story Map alternatives (Kshitij Raj Sharma)](https://kshitijrajsharma.com.np/blog/open-source-story-map/)

### Esri StoryMaps & Alternatives
- [ArcGIS StoryMaps](https://storymaps.arcgis.com/)
- [ArcGIS StoryMaps Alternatives (G2)](https://www.g2.com/products/arcgis-storymaps/competitors/alternatives)
- [Story Maps guide (Duke University Libraries)](https://guides.library.duke.edu/webmapping/story)
- [Alternatives to ArcGIS (Penn Libraries)](https://guides.library.upenn.edu/c.php?g=475370&p=3254298)
- [Open Source Alternative GIS Software (GWU Libraries)](https://libguides.gwu.edu/c.php?g=1453362&p=10882643)
- [StoryMaps competitors (Similarweb)](https://www.similarweb.com/website/storymaps.arcgis.com/competitors/)
- [Columbia University scrollytelling tutorial](https://smorgasbord.cdp.arch.columbia.edu/modules/16-intro-webmapping/163-storytelling/)
