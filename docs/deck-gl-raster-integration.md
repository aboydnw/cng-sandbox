# deck.gl-raster Integration: Improvement Proposals

## Context

[deck.gl-raster](https://github.com/developmentseed/deck.gl-raster) is a Development Seed library that renders GeoTIFF and Cloud-Optimized GeoTIFF (COG) data entirely client-side using GPU shaders. The [existing demo](https://developmentseed.org/deck.gl-raster/examples/land-cover/) renders a 1.3GB NLCD land cover COG with no tile server — just debug controls (mesh wireframe, error threshold) and a basic legend.

The CNG Sandbox already surpasses the demo in many ways: band selection, 11 colormaps, opacity controls, temporal animation with GIF/MP4 export, and a proper legend system. The opportunity is to integrate deck.gl-raster's **client-side rendering** to unlock capabilities that server-rendered tiles (via titiler) fundamentally cannot provide.

## Core difference: server-rendered vs client-rendered tiles

Today, titiler renders colored PNGs on the server. The browser never sees raw pixel values — it just displays images. deck.gl-raster sends raw raster data to GPU shaders, which means the browser has direct access to band values. This is the key unlock.

## Proposed features

### 1. Pixel inspector

Hover or click anywhere on the map to see actual band values at that point. This is the single most-requested feature in geospatial viewers and is currently impossible with pre-rendered PNG tiles.

**UX**: A floating tooltip follows the cursor showing band name(s), value(s), and units. Click to pin an inspection point. Multiple pins could be compared in a side panel.

### 2. Client-side band math

Let users build expressions like `(B5-B4)/(B5+B4)` for NDVI without a server round-trip. The GPU evaluates the expression per-pixel in real time.

**UX**: Offer presets (NDVI, NDWI, false color composite) as one-click buttons, plus a freeform expression input for advanced users. Results render instantly as the expression is edited.

### 3. Instant colormap and rescale

Changing the colormap or adjusting min/max currently re-fetches every tile from titiler. With client-side rendering, it's a shader uniform change — no network, no latency.

**UX**: The existing colormap dropdown and any future min/max sliders become instant-feedback controls. Dragging a rescale slider updates the entire viewport in real time.

### 4. Histogram-driven stretching

With access to raw values, compute a histogram and offer stretch modes: linear, percentile clip (2%–98%), and histogram equalization. This matters for scientific data where default min/max often looks washed out.

**UX**: A small histogram widget sits below the colormap selector. Users drag handles to set clip bounds. Preset stretch modes are available as buttons.

### 5. Split-screen compare

A draggable vertical divider lets users compare two renderings side-by-side — RGB vs NDVI, two time steps, or two different colormaps.

**UX**: A "Compare" toggle activates the split. Each side has independent band/colormap controls. The divider snaps to common positions (25%, 50%, 75%) but is freely draggable.

### 6. 3D terrain drape

deck.gl-raster supports mesh rendering (the demo exposes a `meshMaxError` parameter). Drape raster data over a DEM for elevation-aware visualization.

**UX**: A "3D" toggle tilts the viewport and applies terrain exaggeration. An exaggeration slider lets users control the vertical scale. Most dramatic for mountainous or bathymetric datasets.

### 7. Eliminate titiler for COG viewing

Serve COGs directly from MinIO via HTTP range requests. The browser fetches only the bytes it needs, and GPU shaders handle rendering. This simplifies the architecture (fewer containers) and reduces server load.

**Architecture change**: titiler remains for pgSTAC search/query endpoints but is no longer in the rendering path for individual COG visualization.

## Tradeoffs

| | titiler (current) | deck.gl-raster |
|---|---|---|
| Server load | High (renders every tile) | Near zero (serves bytes via range requests) |
| Client load | Low (displays PNGs) | Higher (GPU shader work) |
| Raw pixel access | No | Yes |
| Band math | Server-side only | Client-side, real-time |
| Colormap changes | Re-fetch all tiles | Instant (shader uniform) |
| Browser support | Universal | Requires WebGL2 |
| Large datasets | Scales well (server does work) | Limited by client GPU/memory |

## Recommendation

Make deck.gl-raster the **default viewer** for single COGs. Keep titiler as a fallback for very large datasets and for pgSTAC catalog search queries. The pixel inspector, band math, and instant colormaps are functionality that no amount of server-side rendering can replicate — and they represent a clear step up from the demo's minimal wireframe-toggle UI.

## Test data

For initial prototyping, use the publicly hosted NLCD COG from the deck.gl-raster demo:

```
https://s3.us-east-1.amazonaws.com/ds-deck.gl-raster-public/cog/Annual_NLCD_LndCov_2024_CU_C1V1.tif
```

This is the USGS Annual National Land Cover Database (2024), 30m resolution, 16-class land cover for CONUS. ~1.3GB COG with CORS enabled. Source: [MRLC Consortium](https://www.mrlc.gov/data/project/annual-nlcd).

## Status

This document captures the initial feature proposals. Implementation has not started. The backend STAC validation library integration (rio-stac, pystac, geojson-pydantic) was completed on branch `feat/stac-validation-libraries` and is a prerequisite for this work.
