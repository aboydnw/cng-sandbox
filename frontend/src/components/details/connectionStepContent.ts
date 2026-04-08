import type { Connection } from "../../types";
import type { StepContent, MetadataTileData, ToolCardData } from "./types";

function formatBounds(bounds: readonly number[] | null | undefined): string {
  if (!bounds || bounds.length < 4) return "—";
  const [w, s, e, n] = bounds;
  if (w <= -179 && e >= 179 && s <= -89 && n >= 89) return "Global coverage";
  const lon = (v: number) => `${Math.abs(v).toFixed(1)}° ${v < 0 ? "W" : "E"}`;
  const lat = (v: number) => `${Math.abs(v).toFixed(1)}° ${v < 0 ? "S" : "N"}`;
  return `${lon(w)} to ${lon(e)}, ${lat(s)} to ${lat(n)}`;
}

function formatZoomRange(
  minZoom: number | null | undefined,
  maxZoom: number | null | undefined,
  fallback: string
): string {
  return minZoom != null && maxZoom != null
    ? `${minZoom} – ${maxZoom}`
    : fallback;
}

function getSourceStep(connection: Connection): StepContent {
  const type = connection.connection_type;

  if (type === "cog") {
    const metadata: MetadataTileData[] = [
      { label: "Format", value: "Cloud-Optimized GeoTIFF" },
      {
        label: "Bands",
        value: connection.band_count != null ? `${connection.band_count}` : "—",
      },
      {
        label: "Bounding Box",
        value: formatBounds(connection.bounds),
        colSpan: 2,
      },
      { label: "Source URL", value: connection.url, colSpan: 2 },
    ];

    const tools: ToolCardData[] = [
      {
        name: "Cloud-Optimized GeoTIFF",
        url: "https://www.cogeo.org/",
        description:
          "A GeoTIFF with internal tiling and overviews. HTTP range requests let clients read just the pixels they need without downloading the whole file.",
      },
    ];

    return {
      label: "Source",
      subtitle: "remote file",
      badge: "Step 1 of 2",
      title: "Connected to a Cloud-Optimized GeoTIFF",
      explanation: [
        "This connection points to a <strong>Cloud-Optimized GeoTIFF</strong> (COG) hosted remotely. Unlike a regular GeoTIFF, a COG is internally tiled with multi-resolution overviews.",
        "The tile server reads this file over HTTP using <strong>range requests</strong> — fetching only the bytes needed for each tile, without ever downloading the entire file.",
      ],
      metadata,
      tools,
      toolSectionTitle: "About this format",
    };
  }

  if (type === "pmtiles") {
    const metadata: MetadataTileData[] = [
      {
        label: "Format",
        value: "PMTiles v3",
      },
      {
        label: "Tile Type",
        value: connection.tile_type ?? "unknown",
      },
      {
        label: "Zoom Range",
        value: formatZoomRange(connection.min_zoom, connection.max_zoom, "—"),
      },
      {
        label: "Bounding Box",
        value: formatBounds(connection.bounds),
        colSpan: 2,
      },
      { label: "Source URL", value: connection.url, colSpan: 2 },
    ];

    const tools: ToolCardData[] = [
      {
        name: "PMTiles",
        url: "https://docs.protomaps.com/pmtiles/",
        description:
          "A single-file tile archive with a built-in directory that maps tile coordinates to byte ranges. No tile server needed — the browser reads tiles directly via HTTP range requests.",
      },
      {
        name: "Protomaps",
        url: "https://protomaps.com/",
        description:
          "The open source ecosystem behind PMTiles — tools for creating, hosting, and displaying serverless map tiles.",
      },
    ];

    return {
      label: "Source",
      subtitle: "tile archive",
      badge: "Step 1 of 2",
      title: "Connected to a PMTiles archive",
      explanation: [
        "This connection points to a <strong>PMTiles</strong> archive — a single file that bundles thousands of map tiles with an internal directory.",
        "The browser first reads the directory (a small header), then fetches individual tiles on demand using <strong>HTTP range requests</strong>. No tile server is needed — the file can be hosted on any static storage like S3, R2, or a CDN.",
      ],
      metadata,
      tools,
      toolSectionTitle: "About this format",
    };
  }

  if (type === "xyz_raster") {
    const metadata: MetadataTileData[] = [
      { label: "Format", value: "XYZ Raster Tiles" },
      { label: "Tile Type", value: "raster (pre-rendered)" },
      { label: "URL Template", value: connection.url, colSpan: 2 },
    ];

    const tools: ToolCardData[] = [
      {
        name: "Slippy Map Tiles",
        url: "https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames",
        description:
          "The web mapping standard for tiled maps. Each tile is a 256x256 image addressed by zoom level, column, and row — the {z}/{x}/{y} URL pattern.",
      },
    ];

    return {
      label: "Source",
      subtitle: "tile service",
      badge: "Step 1 of 2",
      title: "Connected to an XYZ raster tile service",
      explanation: [
        "This connection uses the <strong>XYZ tile convention</strong> — the most widely used standard for web map tiles. Each tile is a pre-rendered image at a specific zoom level and grid position.",
        "The URL template contains <code>{z}/{x}/{y}</code> placeholders. For each tile the map needs, the browser substitutes the zoom level, column, and row to construct the request URL.",
      ],
      metadata,
      tools,
      toolSectionTitle: "About this format",
    };
  }

  // xyz_vector
  const metadata: MetadataTileData[] = [
    { label: "Format", value: "XYZ Vector Tiles" },
    { label: "Tile Type", value: "vector (MVT)" },
    { label: "URL Template", value: connection.url, colSpan: 2 },
  ];

  const tools: ToolCardData[] = [
    {
      name: "Mapbox Vector Tiles",
      url: "https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/",
      description:
        "An open standard for encoding vector geometries into tile-sized protobuf packages. The browser receives raw geometry and renders it client-side with full style control.",
    },
  ];

  return {
    label: "Source",
    subtitle: "tile service",
    badge: "Step 1 of 2",
    title: "Connected to an XYZ vector tile service",
    explanation: [
      "This connection uses <strong>Mapbox Vector Tiles</strong> (MVT) served via the XYZ tile convention. Unlike raster tiles, vector tiles contain actual geometry data — points, lines, and polygons.",
      "The browser receives compact protobuf-encoded geometry and renders it client-side using WebGL, enabling smooth zoom transitions, interactive hover effects, and dynamic styling without re-fetching tiles.",
    ],
    metadata,
    tools,
    toolSectionTitle: "About this format",
  };
}

function getDisplayStep(connection: Connection): StepContent {
  const type = connection.connection_type;
  const isVector =
    type === "xyz_vector" ||
    (type === "pmtiles" && connection.tile_type === "vector");

  if (isVector) {
    const metadata: MetadataTileData[] = [
      { label: "Renderer", value: "WebGL (deck.gl MVTLayer)" },
      { label: "Tile Format", value: "MVT (Mapbox Vector Tiles)" },
      {
        label: "Zoom Range",
        value: formatZoomRange(
          connection.min_zoom,
          connection.max_zoom,
          "all levels"
        ),
      },
      {
        label: "Basemap",
        value: "Carto Positron",
        subValue: "OpenStreetMap data",
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "deck.gl",
        url: "https://deck.gl/",
        description:
          "WebGL-powered visualization framework. The MVTLayer decodes vector tiles and renders geometry as GPU-accelerated layers with interactive picking.",
      },
      {
        name: "MapLibre GL JS",
        url: "https://maplibre.org/",
        description:
          "Open source map rendering library providing the basemap, camera controls, and coordinate system for the visualization.",
      },
    ];

    return {
      label: "Display",
      subtitle: "map tiles",
      badge: "Step 2 of 2",
      title: "Rendered as interactive vector tiles",
      explanation: [
        "Vector tiles are decoded in the browser and rendered as <strong>GPU-accelerated geometry</strong> using deck.gl's MVTLayer. Each feature is individually addressable — you can hover, click, and inspect properties.",
        "Because rendering happens client-side, the same tiles support different visual styles without re-fetching. The map composites your data layer over a basemap from Carto.",
      ],
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  if (type === "cog") {
    const metadata: MetadataTileData[] = [
      { label: "Tile Server", value: "titiler (dynamic)" },
      { label: "Renderer", value: "WebGL (deck.gl)" },
      { label: "Tile Format", value: "PNG" },
      { label: "Tile Size", value: "256 x 256 px" },
      {
        label: "Basemap",
        value: "Carto Positron",
        subValue: "OpenStreetMap data",
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "titiler",
        url: "https://developmentseed.org/titiler/",
        description:
          "Dynamic raster tile server that reads COGs via range requests and renders map tiles on demand with rescaling, colormaps, and band math.",
      },
      {
        name: "deck.gl",
        url: "https://deck.gl/",
        description:
          "WebGL-powered visualization framework that composites raster tiles as GPU-accelerated bitmap layers over the basemap.",
      },
    ];

    return {
      label: "Display",
      subtitle: "map tiles",
      badge: "Step 2 of 2",
      title: "Served as dynamic raster tiles via titiler",
      explanation: [
        "When you pan or zoom the map, <strong>titiler</strong> generates tiles on demand by reading only the needed bytes from the remote COG via range requests. The full file is never downloaded.",
        "The tiler applies rescaling and colormap rendering server-side, returning ready-to-display PNG tiles. <strong>deck.gl</strong> composites them as a WebGL layer over the basemap.",
      ],
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  // pmtiles raster or xyz_raster
  const metadata: MetadataTileData[] = [
    {
      label: "Tile Server",
      value: type === "pmtiles" ? "None (serverless)" : "External service",
      subValue: type === "pmtiles" ? "HTTP range requests" : undefined,
    },
    { label: "Renderer", value: "WebGL (deck.gl)" },
    { label: "Tile Format", value: "Pre-rendered images" },
    {
      label: "Basemap",
      value: "Carto Positron",
      subValue: "OpenStreetMap data",
    },
  ];

  const tools: ToolCardData[] = [
    {
      name: "deck.gl",
      url: "https://deck.gl/",
      description:
        "WebGL-powered visualization framework that composites raster tiles as GPU-accelerated bitmap layers over the basemap.",
    },
  ];

  return {
    label: "Display",
    subtitle: "map tiles",
    badge: "Step 2 of 2",
    title: "Rendered as raster map tiles",
    explanation: [
      "Pre-rendered image tiles are fetched and composited directly onto the map using <strong>deck.gl</strong>. Each tile is a small image (typically 256x256 pixels) that the browser requests as you pan and zoom.",
      "Since the tiles are already rendered, what you see is exactly what the source provides — no server-side processing, colormaps, or band selection.",
    ],
    metadata,
    tools,
    toolSectionTitle: "Open source tools used",
  };
}

export function getConnectionStepCount(): number {
  return 2;
}

export function getConnectionStepContent(
  connection: Connection,
  step: number
): StepContent {
  switch (step) {
    case 1:
      return getSourceStep(connection);
    case 2:
      return getDisplayStep(connection);
    default:
      throw new Error(`Invalid step: ${step}`);
  }
}
