// frontend/src/lib/techDescriptions.ts

interface TechDescription {
  role: string;
  name: string;
  description: string;
  url: string;
}

const TECH_DESCRIPTIONS: Record<string, TechDescription> = {
  "rio-cogeo": {
    role: "Converted",
    name: "rio-cogeo",
    description:
      "Reorganized your GeoTIFF into a Cloud Optimized GeoTIFF (COG) — a format designed for efficient HTTP range requests. Only the tiles you view are fetched, instead of downloading the entire file.",
    url: "https://github.com/cogeotiff/rio-cogeo",
  },
  xarray: {
    role: "Converted",
    name: "xarray + rio-cogeo",
    description:
      "Extracted variables from your NetCDF file using xarray, then converted each to a Cloud Optimized GeoTIFF for efficient tile-based access.",
    url: "https://github.com/pydata/xarray",
  },
  GeoPandas: {
    role: "Converted",
    name: "GeoPandas",
    description:
      "Read your vector geometries and attributes, reprojected to web-friendly coordinates, and wrote to GeoParquet for efficient columnar access.",
    url: "https://github.com/geopandas/geopandas",
  },
  tippecanoe: {
    role: "Tiled",
    name: "tippecanoe",
    description:
      "Generated PMTiles — a single-file archive of pre-computed vector tiles at every zoom level, optimized for HTTP range requests.",
    url: "https://github.com/felt/tippecanoe",
  },
  MinIO: {
    role: "Stored",
    name: "MinIO (S3-compatible)",
    description:
      "Your converted file is stored in an S3-compatible object store where tilers access it via HTTP range requests — the same protocol used by AWS S3 and Google Cloud Storage.",
    url: "https://github.com/minio/minio",
  },
  pgSTAC: {
    role: "Cataloged",
    name: "pgSTAC + STAC API",
    description:
      "Your dataset is registered in a STAC catalog — a standard for describing geospatial data. This is how the tiler knows where your file is and what area and time it covers.",
    url: "https://github.com/stac-utils/pgstac",
  },
  PostGIS: {
    role: "Cataloged",
    name: "PostGIS",
    description:
      "Your vector data is stored in a PostGIS-enabled PostgreSQL database, enabling spatial queries and dynamic MVT tile generation.",
    url: "https://github.com/postgis/postgis",
  },
  titiler: {
    role: "Displayed",
    name: "titiler + deck.gl",
    description:
      "titiler serves map tiles on demand from your COG, reading only the pixels needed for each tile. deck.gl renders those tiles in your browser with GPU acceleration.",
    url: "https://github.com/developmentseed/titiler",
  },
  tipg: {
    role: "Displayed",
    name: "tipg + MapLibre",
    description:
      "tipg generates vector tiles on the fly from your PostGIS table. MapLibre GL JS renders them in the browser with hardware-accelerated WebGL.",
    url: "https://github.com/developmentseed/tipg",
  },
  "deck.gl": {
    role: "Displayed",
    name: "deck.gl (client-side)",
    description:
      "Reads the COG file directly in your browser using GPU-accelerated rendering — no tile server needed. Powered by @developmentseed/deck.gl-geotiff.",
    url: "https://github.com/visgl/deck.gl",
  },
  PMTiles: {
    role: "Displayed",
    name: "PMTiles + MapLibre",
    description:
      "Pre-computed vector tiles served from a single file via HTTP range requests. MapLibre GL JS renders them in the browser with hardware-accelerated WebGL.",
    url: "https://github.com/protomaps/PMTiles",
  },
};

export function getTechCards(
  credits: { tool: string; role: string; url: string }[],
  formatPair: string,
  tileUrl: string,
  renderMode?: string,
): TechDescription[] {
  const cards: TechDescription[] = [];
  const seen = new Set<string>();

  // Conversion tool(s)
  for (const c of credits) {
    const desc = TECH_DESCRIPTIONS[c.tool];
    if (desc && !seen.has(desc.role + desc.name)) {
      seen.add(desc.role + desc.name);
      cards.push(desc);
    }
  }

  // Storage — always MinIO for raster, PostGIS for vector via tipg
  const isVector = formatPair.includes("geoparquet");
  const isPmtiles = tileUrl?.startsWith("/pmtiles/");
  if (isVector && !isPmtiles) {
    if (!seen.has("Cataloged" + "PostGIS")) cards.push(TECH_DESCRIPTIONS["PostGIS"]);
  } else {
    if (!seen.has("Stored" + "MinIO (S3-compatible)")) cards.push(TECH_DESCRIPTIONS["MinIO"]);
    if (!seen.has("Cataloged" + "pgSTAC + STAC API")) cards.push(TECH_DESCRIPTIONS["pgSTAC"]);
  }

  // Display tool
  if (isVector) {
    if (isPmtiles) {
      if (!seen.has("Displayed" + "PMTiles + MapLibre")) cards.push(TECH_DESCRIPTIONS["PMTiles"]);
    } else {
      if (!seen.has("Displayed" + "tipg + MapLibre")) cards.push(TECH_DESCRIPTIONS["tipg"]);
    }
  } else {
    const rasterDisplay = renderMode === "client" ? "deck.gl" : "titiler";
    cards.push(TECH_DESCRIPTIONS[rasterDisplay]);
  }

  return cards;
}

export type { TechDescription };
