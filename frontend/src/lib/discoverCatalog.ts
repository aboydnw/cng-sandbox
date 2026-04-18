/**
 * Mock source.coop catalog used by /discover demo pages.
 *
 * Entries with `supported: true` correspond to curated products registered on
 * the backend (`is_example=True` datasets). The discover detail page resolves
 * these to a real dataset id at runtime so "Visualize in sandbox" deep-links
 * to the map page. Unsupported entries are browse-only and link out to
 * source.coop.
 */

export interface CatalogFile {
  path: string;
  size: string;
}

export interface CatalogEntry {
  slug: string;
  org: string;
  name: string;
  title: string;
  tagline: string;
  description: string;
  readme: string;
  tags: string[];
  license: string;
  updated: string;
  thumbnail: string;
  supported: boolean;
  externalUrl: string;
  files: CatalogFile[];
}

const GHRSST_README = `## Overview

The Multi-scale Ultra-high Resolution (MUR) Sea Surface Temperature (SST) analysis
is a daily, gap-free, global 0.01° product produced by JPL PO.DAAC. Data are
foundation-level SST derived from multiple satellite instruments and \`in-situ\`
observations.

## Contents

The 2024 subset published here comprises 366 daily COGs covering the full globe,
each accompanied by a STAC Item sidecar. Files are stored as cloud-optimized
GeoTIFFs on Cloudflare R2 and are directly tileable from this archive.

## Citation

JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea Surface
Temperature Analysis. Ver. 4.1. PO.DAAC, CA, USA.`;

const GEBCO_README = `## Overview

The General Bathymetric Chart of the Oceans (GEBCO) is a publicly available
global terrain model for ocean and land at 15 arc-second intervals. The 2024
release reflects the TID-flag and source-data updates incorporated by BODC.

## Contents

A single global COG (~12.8 GB at native resolution) with over/underviews at
consistent levels. Suitable for global ocean-floor visualization at web scale.

## License

Released under the GEBCO data policy (CC-BY equivalent attribution). See the
GEBCO website for full terms.`;

const CARBON_README = `## Overview

Gross annual carbon emissions from deforestation, 2001–2023, produced by the
WRI Land & Carbon Lab. The headline emissions raster is pinned here for the
visualization sandbox — the source bucket contains an atlas of related layers
(forest loss drivers, above-ground biomass, peatland carbon).

## Contents

A single 100-meter resolution COG covering the tropics. Values are tCO₂e /
pixel / year, summed across the full time series.

## License

Creative Commons Attribution 4.0 International (CC-BY-4.0). Please cite as
Harris et al. 2021.`;

const HLS_README = `## Overview

Harmonized Landsat Sentinel-2 (HLS) provides surface reflectance from Landsat
8/9 OLI and Sentinel-2 MSI sensors, harmonized to a common spatial (30 m) and
radiometric reference. NASA LP DAAC processes these data operationally.

## Contents

Daily 30 m COGs, tiled on the MGRS grid. This subset is a regional cut
organized by year and tile, with STAC sidecars.`;

const OVERTURE_README = `## Overview

Overture Maps Foundation's \`places\` theme: a global point dataset of named
places-of-interest assembled from open and member-contributed sources.

## Contents

Monthly GeoParquet snapshots, partitioned by H3 cell. The theme totals ~60M
features globally.`;

const FIELDS_README = `## Overview

Fields2030 from fiboa is a cross-country, harmonized field-boundary dataset
intended as a shared reference for agricultural analytics at continental scale.`;

const USDA_README = `## Overview

The USDA Cropland Data Layer (CDL) provides an annual 30 m raster of cultivated
crops across the conterminous United States.`;

const NASA_VIIRS_README = `## Overview

Visible Infrared Imaging Radiometer Suite (VIIRS) nighttime lights: monthly
composites of radiance-calibrated stray-light-corrected at-sensor radiance.`;

const USGS_DEM_README = `## Overview

USGS 3D Elevation Program (3DEP) 1/3 arc-second DEM — the canonical elevation
product for the conterminous United States, provided as mosaicked COGs.`;

export const discoverCatalog: CatalogEntry[] = [
  {
    slug: "ausantarctic/ghrsst-mur-v2",
    org: "ausantarctic",
    name: "ghrsst-mur-v2",
    title: "GHRSST MUR v2 — Daily SST (2024)",
    tagline: "Daily gap-free global sea surface temperature, 0.01° resolution.",
    description:
      "Multi-scale Ultra-high Resolution sea surface temperature analysis, daily global coverage. This subset shows the 2024 daily series (366 days) as cloud-optimized GeoTIFFs.",
    readme: GHRSST_README,
    tags: ["ocean", "temperature", "temporal", "cog", "stac"],
    license: "Public domain (NASA JPL)",
    updated: "2025-01-14",
    thumbnail: "/thumbnails/ghrsst.jpg",
    supported: true,
    externalUrl: "https://source.coop/ausantarctic/ghrsst-mur-v2",
    files: [
      { path: "2024/001/mur_20240101_sst.tif", size: "438 MB" },
      { path: "2024/001/mur_20240101_sst.json", size: "3.1 KB" },
      { path: "2024/002/mur_20240102_sst.tif", size: "441 MB" },
      { path: "…", size: "" },
      { path: "2024/366/mur_20241231_sst.tif", size: "439 MB" },
    ],
  },
  {
    slug: "alexgleith/gebco-2024",
    org: "alexgleith",
    name: "gebco-2024",
    title: "GEBCO 2024 Bathymetry",
    tagline: "Global ocean-floor and land terrain model, 15 arc-second grid.",
    description:
      "Global ocean and land terrain model from the General Bathymetric Chart of the Oceans, 2024 release.",
    readme: GEBCO_README,
    tags: ["bathymetry", "terrain", "global", "cog"],
    license: "CC-BY 4.0",
    updated: "2024-07-02",
    thumbnail: "/thumbnails/gebco.jpg",
    supported: true,
    externalUrl: "https://source.coop/alexgleith/gebco-2024",
    files: [
      { path: "gebco_2024_cog.tif", size: "12.8 GB" },
      { path: "README.md", size: "4.2 KB" },
    ],
  },
  {
    slug: "vizzuality/lg-land-carbon-data",
    org: "vizzuality",
    name: "lg-land-carbon-data",
    title: "Land & Carbon Lab: Deforestation Carbon Emissions",
    tagline: "Gross emissions from deforestation, 100 m, 2001–2023.",
    description:
      "Gross carbon emissions from deforestation at 100 m resolution, produced by the WRI Land & Carbon Lab.",
    readme: CARBON_README,
    tags: ["carbon", "deforestation", "climate", "cog"],
    license: "CC-BY 4.0",
    updated: "2024-11-20",
    thumbnail: "/thumbnails/lg-land-carbon.jpg",
    supported: true,
    externalUrl: "https://source.coop/vizzuality/lg-land-carbon-data",
    files: [
      { path: "deforest_carbon_100m_cog.tif", size: "8.4 GB" },
      { path: "atlas/forest_loss_driver.tif", size: "2.1 GB" },
      { path: "atlas/biomass_agb.tif", size: "5.7 GB" },
    ],
  },
  {
    slug: "nasa/hls",
    org: "nasa",
    name: "hls",
    title: "HLS — Harmonized Landsat Sentinel-2",
    tagline: "Daily 30 m surface reflectance, Landsat + Sentinel-2 harmonized.",
    description:
      "Harmonized Landsat Sentinel-2 surface reflectance, 30 m, tiled on the MGRS grid with STAC sidecars. Operational NASA LP DAAC product.",
    readme: HLS_README,
    tags: ["imagery", "optical", "temporal", "stac", "cog"],
    license: "NASA public data",
    updated: "2025-02-03",
    thumbnail: "/thumbnails/ghrsst.jpg",
    supported: false,
    externalUrl: "https://source.coop/nasa/hls",
    files: [
      {
        path: "2024/T15TWK/HLS.S30.T15TWK.2024365.v2.0.B04.tif",
        size: "68 MB",
      },
      {
        path: "2024/T15TWK/HLS.S30.T15TWK.2024365.v2.0.B08.tif",
        size: "68 MB",
      },
      { path: "…", size: "" },
    ],
  },
  {
    slug: "overturemaps/places",
    org: "overturemaps",
    name: "places",
    title: "Overture Maps — Places",
    tagline: "60M global points of interest, monthly GeoParquet release.",
    description:
      "Overture Maps Foundation's places theme: a global point dataset of named POIs assembled from open and member-contributed sources. Monthly snapshots in GeoParquet.",
    readme: OVERTURE_README,
    tags: ["vector", "pois", "geoparquet", "global"],
    license: "ODbL / CDLA-P 2.0",
    updated: "2025-03-12",
    thumbnail: "/thumbnails/gebco.jpg",
    supported: false,
    externalUrl: "https://source.coop/overturemaps/places",
    files: [
      {
        path: "release=2025-03-12/theme=places/type=place/part-00000.parquet",
        size: "412 MB",
      },
      {
        path: "release=2025-03-12/theme=places/type=place/part-00001.parquet",
        size: "408 MB",
      },
      { path: "…", size: "" },
    ],
  },
  {
    slug: "fiboa/fields2030",
    org: "fiboa",
    name: "fields2030",
    title: "Fields2030 — Harmonized Field Boundaries",
    tagline: "Cross-country harmonized agricultural field polygons.",
    description:
      "A shared reference dataset of field boundaries spanning multiple national programs, released under the fiboa schema as GeoParquet.",
    readme: FIELDS_README,
    tags: ["vector", "agriculture", "geoparquet"],
    license: "CC-BY 4.0",
    updated: "2025-01-28",
    thumbnail: "/thumbnails/lg-land-carbon.jpg",
    supported: false,
    externalUrl: "https://source.coop/fiboa/fields2030",
    files: [
      { path: "country=us/year=2024/part-00000.parquet", size: "1.1 GB" },
      { path: "country=fr/year=2024/part-00000.parquet", size: "620 MB" },
      { path: "country=de/year=2024/part-00000.parquet", size: "840 MB" },
    ],
  },
  {
    slug: "usda/cdl",
    org: "usda",
    name: "cdl",
    title: "USDA Cropland Data Layer",
    tagline: "Annual 30 m CONUS crop-type raster, 1997–present.",
    description:
      "The Cropland Data Layer (CDL) is a raster, geo-referenced, crop-specific land-cover map for the continental United States.",
    readme: USDA_README,
    tags: ["agriculture", "categorical", "cog", "conus"],
    license: "Public domain (USDA NASS)",
    updated: "2024-02-15",
    thumbnail: "/thumbnails/gebco.jpg",
    supported: false,
    externalUrl: "https://source.coop/usda/cdl",
    files: [
      { path: "2024/cdl_2024_conus.tif", size: "2.3 GB" },
      { path: "2023/cdl_2023_conus.tif", size: "2.2 GB" },
      { path: "…", size: "" },
    ],
  },
  {
    slug: "nasa/viirs-nightlights",
    org: "nasa",
    name: "viirs-nightlights",
    title: "VIIRS Black Marble — Monthly Nighttime Lights",
    tagline: "Stray-light-corrected nighttime radiance composites.",
    description:
      "Monthly VIIRS DNB composites, atmospherically and stray-light-corrected, provided as 500 m COGs. Useful for economic activity, conflict, and grid-resilience analysis.",
    readme: NASA_VIIRS_README,
    tags: ["imagery", "nighttime", "temporal", "cog"],
    license: "NASA public data",
    updated: "2025-03-01",
    thumbnail: "/thumbnails/ghrsst.jpg",
    supported: false,
    externalUrl: "https://source.coop/nasa/viirs-nightlights",
    files: [
      { path: "2025/03/viirs_ntl_2025_03.tif", size: "1.4 GB" },
      { path: "2025/02/viirs_ntl_2025_02.tif", size: "1.4 GB" },
      { path: "…", size: "" },
    ],
  },
  {
    slug: "usgs/3dep-dem",
    org: "usgs",
    name: "3dep-dem",
    title: "USGS 3DEP — 1/3 arc-second DEM",
    tagline: "Canonical CONUS elevation, ~10 m ground sample distance.",
    description:
      "USGS 3DEP 1/3 arc-second digital elevation model for the conterminous United States, served as mosaicked COGs.",
    readme: USGS_DEM_README,
    tags: ["terrain", "elevation", "cog", "conus"],
    license: "Public domain (USGS)",
    updated: "2024-10-04",
    thumbnail: "/thumbnails/lg-land-carbon.jpg",
    supported: false,
    externalUrl: "https://source.coop/usgs/3dep-dem",
    files: [
      { path: "n40w090/usgs_ned_13_n40w090.tif", size: "420 MB" },
      { path: "n40w089/usgs_ned_13_n40w089.tif", size: "418 MB" },
      { path: "…", size: "" },
    ],
  },
];

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return discoverCatalog.find((e) => e.slug === slug);
}

export function listingUrlForSlug(slug: string): string {
  return `https://data.source.coop/${slug}/`;
}
