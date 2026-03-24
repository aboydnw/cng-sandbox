import type { Dataset } from "../../types";
import type {
  StepContent,
  MetadataTileData,
  ToolCardData,
  BeforeAfter,
} from "./types";

export type PipelineType = "raster" | "vector-postgis" | "vector-pmtiles";

export function getPipelineType(dataset: Dataset): PipelineType {
  if (dataset.dataset_type === "raster") return "raster";
  if (dataset.tile_url?.startsWith("/pmtiles/")) return "vector-pmtiles";
  return "vector-postgis";
}

export function getStepCount(_dataset: Dataset): number {
  return 4;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

function formatBounds(bounds: readonly number[] | null | undefined): string {
  if (!bounds || bounds.length < 4) return "—";
  const [w, s, e, n] = bounds;
  if (w <= -179 && e >= 179 && s <= -89 && n >= 89) return "Global coverage";
  return `${w.toFixed(1)}° to ${e.toFixed(1)}° E, ${s.toFixed(1)}° to ${n.toFixed(1)}° N`;
}

function labelFromFormatPair(formatPair: string): string {
  if (formatPair.startsWith("shapefile")) return "Shapefile";
  if (formatPair.startsWith("geojson")) return "GeoJSON";
  if (formatPair.startsWith("geotiff")) return "GeoTIFF";
  if (formatPair.startsWith("netcdf")) return "NetCDF";
  if (formatPair.startsWith("hdf5")) return "HDF5";
  return "Original file";
}

function getConvertStep(dataset: Dataset, pipeline: PipelineType): StepContent {
  if (pipeline === "raster") {
    const metadata: MetadataTileData[] = [
      {
        label: "Projection",
        value: dataset.crs ?? "—",
        subValue: dataset.crs_name ?? undefined,
      },
      {
        label: "Resolution",
        value: dataset.resolution != null ? `${dataset.resolution}°/px` : "—",
      },
      {
        label: "Dimensions",
        value:
          dataset.pixel_width != null && dataset.pixel_height != null
            ? `${dataset.pixel_width} × ${dataset.pixel_height}`
            : "—",
      },
      {
        label: "Bands",
        value:
          dataset.band_count != null
            ? `${dataset.band_count}${dataset.band_names?.length ? ` (${dataset.band_names.join(", ")})` : ""}`
            : "—",
      },
      {
        label: "Data Type",
        value: dataset.dtype ?? "—",
      },
      {
        label: "Value Range",
        value:
          dataset.raster_min != null && dataset.raster_max != null
            ? `${dataset.raster_min} – ${dataset.raster_max}`
            : "—",
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "rio-cogeo",
        url: "https://cogeotiff.github.io/rio-cogeo/",
        description:
          "Cloud Optimized GeoTIFF (COG) plugin for Rasterio, used to create and validate COG files.",
      },
      {
        name: "GDAL",
        url: "https://gdal.org/",
        description:
          "Geospatial Data Abstraction Library — the foundational toolkit for reading and writing raster and vector formats.",
      },
    ];

    const beforeAfter: BeforeAfter = {
      beforeLabel: "Original GeoTIFF",
      beforeValue: formatBytes(dataset.original_file_size),
      afterLabel: "Cloud Optimized GeoTIFF",
      afterValue: formatBytes(dataset.converted_file_size),
      note: "COGs use internal tiling and overviews for efficient cloud access.",
    };

    return {
      label: "Convert",
      subtitle: "cloud-native",
      badge: "Step 1 of 4",
      title: "Converted to Cloud Optimized GeoTIFF (COG)",
      explanation: [
        "Your raster file was converted to a <strong>Cloud Optimized GeoTIFF</strong> (COG) — a standard format designed for efficient access from cloud object storage.",
        "COGs store data with internal tiling and multi-resolution overviews, so map viewers can request only the pixels they need without downloading the entire file.",
      ],
      beforeAfter,
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  if (pipeline === "vector-pmtiles") {
    const sourceLabel = labelFromFormatPair(dataset.format_pair ?? "");

    const metadata: MetadataTileData[] = [
      {
        label: "Projection",
        value: dataset.crs ?? "—",
        subValue: dataset.crs_name ?? undefined,
      },
      {
        label: "Features",
        value: dataset.feature_count != null ? `${dataset.feature_count}` : "—",
      },
      {
        label: "Geometry",
        value: dataset.geometry_types?.join(", ") ?? "—",
      },
      {
        label: "Bounding Box",
        value: formatBounds(dataset.bounds),
        colSpan: 2,
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "tippecanoe",
        url: "https://github.com/felt/tippecanoe",
        description:
          "Builds vector tilesets from GeoJSON features, producing PMTiles archives optimized for web display.",
      },
      {
        name: "GeoPandas",
        url: "https://geopandas.org/",
        description:
          "Python library for geospatial data manipulation, used to read and transform vector data.",
      },
    ];

    const beforeAfter: BeforeAfter = {
      beforeLabel: `Original ${sourceLabel}`,
      beforeValue: formatBytes(dataset.original_file_size),
      afterLabel: "PMTiles archive",
      afterValue: formatBytes(dataset.converted_file_size),
      note: "PMTiles is a single-file archive of vector tiles for serverless map hosting.",
    };

    return {
      label: "Convert",
      subtitle: "cloud-native",
      badge: "Step 1 of 4",
      title: "Converted to PMTiles vector tile archive",
      explanation: [
        "Your vector file was converted to a <strong>PMTiles</strong> archive — a single-file format that bundles pre-rendered vector tiles for efficient serverless hosting.",
        "PMTiles can be served directly from object storage without a tile server, making it ideal for static deployments.",
      ],
      beforeAfter,
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  // vector-postgis
  const sourceLabel = labelFromFormatPair(dataset.format_pair ?? "");

  const metadata: MetadataTileData[] = [
    {
      label: "Projection",
      value: dataset.crs ?? "—",
      subValue: dataset.crs_name ?? undefined,
    },
    {
      label: "Features",
      value: dataset.feature_count != null ? `${dataset.feature_count}` : "—",
    },
    {
      label: "Geometry",
      value: dataset.geometry_types?.join(", ") ?? "—",
    },
    {
      label: "Bounding Box",
      value: formatBounds(dataset.bounds),
      colSpan: 2,
    },
  ];

  const tools: ToolCardData[] = [
    {
      name: "GeoPandas",
      url: "https://geopandas.org/",
      description:
        "Python library for geospatial data manipulation, used to read source files and write GeoParquet.",
    },
    {
      name: "Apache Parquet",
      url: "https://parquet.apache.org/",
      description:
        "Columnar storage format. GeoParquet extends it with geometry encoding for efficient geospatial analytics.",
    },
    {
      name: "pyogrio",
      url: "https://pyogrio.readthedocs.io/",
      description:
        "Fast vectorized reading and writing of OGR vector data sources, including Shapefiles and GeoJSON.",
    },
  ];

  const beforeAfter: BeforeAfter = {
    beforeLabel: `Original ${sourceLabel}`,
    beforeValue: formatBytes(dataset.original_file_size),
    afterLabel: "GeoParquet",
    afterValue: formatBytes(dataset.geoparquet_file_size ?? dataset.converted_file_size),
    note: "GeoParquet is a cloud-native columnar format for vector data.",
  };

  return {
    label: "Convert",
    subtitle: "cloud-native",
    badge: "Step 1 of 4",
    title: "Converted to GeoParquet",
    explanation: [
      "Your vector file was converted to <strong>GeoParquet</strong> — a cloud-native columnar format that enables efficient querying and spatial operations.",
      "GeoParquet stores geometry alongside tabular attributes in a compact binary format, reducing storage and improving query performance.",
    ],
    beforeAfter,
    metadata,
    tools,
    toolSectionTitle: "Open source tools used",
  };
}

function getCatalogStep(dataset: Dataset, pipeline: PipelineType): StepContent {
  if (pipeline === "raster") {
    const metadata: MetadataTileData[] = [
      {
        label: "Collection ID",
        value: dataset.stac_collection_id ?? "—",
        colSpan: 2,
      },
      {
        label: "Zoom Range",
        value:
          dataset.min_zoom != null && dataset.max_zoom != null
            ? `${dataset.min_zoom} – ${dataset.max_zoom}`
            : "—",
      },
      {
        label: "Bounding Box",
        value: formatBounds(dataset.bounds),
        colSpan: 2,
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "pgSTAC",
        url: "https://github.com/stac-utils/pgstac",
        description:
          "PostgreSQL schema and functions for efficient STAC item and collection storage at scale.",
      },
      {
        name: "stac-fastapi",
        url: "https://github.com/stac-utils/stac-fastapi",
        description:
          "FastAPI-based STAC API implementation with pgSTAC backend for searchable geospatial catalogs.",
      },
    ];

    return {
      label: "Catalog",
      subtitle: "searchable",
      badge: "Step 2 of 4",
      title: "Registered in a STAC catalog",
      explanation: [
        "The COG was registered as a <strong>STAC item</strong> in a spatiotemporal asset catalog (STAC) — an open standard for describing geospatial data.",
        "STAC makes assets discoverable and queryable by time, location, and metadata, enabling interoperability with the broader geospatial ecosystem.",
      ],
      beforeAfter: undefined,
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  // vector pipelines
  const metadata: MetadataTileData[] = [
    {
      label: "Table",
      value: dataset.pg_table ?? "—",
      colSpan: 2,
    },
    {
      label: "Zoom Range",
      value:
        dataset.min_zoom != null && dataset.max_zoom != null
          ? `${dataset.min_zoom} – ${dataset.max_zoom}`
          : "—",
    },
    {
      label: "Bounding Box",
      value: formatBounds(dataset.bounds),
      colSpan: 2,
    },
  ];

  const tools: ToolCardData[] = [
    {
      name: "PostGIS",
      url: "https://postgis.net/",
      description:
        "Spatial extension for PostgreSQL providing geometry types, spatial indexing, and GIS functions.",
    },
    {
      name: "tipg",
      url: "https://developmentseed.org/tipg/",
      description:
        "OGC Features and Tiles API built on PostGIS — serves queryable vector tiles directly from PostgreSQL tables.",
    },
  ];

  return {
    label: "Catalog",
    subtitle: "queryable",
    badge: "Step 2 of 4",
    title: "Loaded into a queryable PostGIS database",
    explanation: [
      "The vector data was loaded into <strong>PostGIS</strong> — a spatially-enabled PostgreSQL database that supports complex geospatial queries.",
      "Storing features in PostGIS makes them queryable by attribute and geometry, and enables dynamic vector tile generation.",
    ],
    beforeAfter: undefined,
    metadata,
    tools,
    toolSectionTitle: "Open source tools used",
  };
}

function getStoreStep(dataset: Dataset, pipeline: PipelineType): StepContent {
  if (pipeline === "raster") {
    const metadata: MetadataTileData[] = [
      {
        label: "Storage",
        value: "Cloudflare R2",
      },
      {
        label: "Format",
        value: "Cloud Optimized GeoTIFF",
      },
      {
        label: "File Size",
        value: formatBytes(dataset.converted_file_size),
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "Cloudflare R2",
        url: "https://www.cloudflare.com/developer-platform/r2/",
        description:
          "S3-compatible object storage with zero egress fees, used to host COG files for tiler access.",
      },
    ];

    return {
      label: "Store",
      subtitle: "cloud hosted",
      badge: "Step 3 of 4",
      title: "Stored in cloud object storage",
      explanation: [
        "The COG file is stored in <strong>Cloudflare R2</strong> — an S3-compatible object store with zero egress fees.",
        "The raster tiler reads bytes directly from R2 on demand, fetching only the tiles needed for the current map view.",
      ],
      beforeAfter: undefined,
      metadata,
      tools,
      toolSectionTitle: "Cloud storage",
    };
  }

  // vector pipelines
  const metadata: MetadataTileData[] = [
    {
      label: "Database",
      value: "PostgreSQL + PostGIS",
    },
    {
      label: "Table",
      value: dataset.pg_table ?? "—",
      colSpan: 2,
    },
    {
      label: "Features",
      value: dataset.feature_count != null ? `${dataset.feature_count}` : "—",
    },
  ];

  const tools: ToolCardData[] = [
    {
      name: "PostgreSQL",
      url: "https://www.postgresql.org/",
      description:
        "Open source relational database. Combined with PostGIS, it stores and queries geospatial vector data.",
    },
    {
      name: "PostGIS",
      url: "https://postgis.net/",
      description:
        "Spatial extension for PostgreSQL adding geometry column types, spatial indexing, and GIS functions.",
    },
  ];

  return {
    label: "Store",
    subtitle: "database",
    badge: "Step 3 of 4",
    title: "Stored in a PostGIS database",
    explanation: [
      "Vector features are persisted in a <strong>PostGIS</strong> table with a spatial index for fast tile generation.",
      "The database serves as both the authoritative store and the live query engine for dynamic vector tiles.",
    ],
    beforeAfter: undefined,
    metadata,
    tools,
    toolSectionTitle: "Open source database tools",
  };
}

function getDisplayStep(dataset: Dataset, pipeline: PipelineType): StepContent {
  if (pipeline === "raster") {
    const metadata: MetadataTileData[] = [
      {
        label: "Zoom Range",
        value:
          dataset.min_zoom != null && dataset.max_zoom != null
            ? `${dataset.min_zoom} – ${dataset.max_zoom}`
            : "—",
      },
      {
        label: "Tile Format",
        value: "PNG / WebP",
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "titiler-pgstac",
        url: "https://github.com/stac-utils/titiler-pgstac",
        description:
          "Dynamic raster tile server for STAC items, generating tiles on demand from COGs stored in object storage.",
      },
      {
        name: "deck.gl",
        url: "https://deck.gl/",
        description:
          "WebGL-powered visualization framework for large-scale geospatial data, used to render raster tiles in the browser.",
      },
    ];

    return {
      label: "Display",
      subtitle: "map tiles",
      badge: "Step 4 of 4",
      title: "Served as dynamic raster map tiles",
      explanation: [
        "<strong>titiler-pgstac</strong> generates raster tiles on demand from the COG, reading only the necessary pixels from R2 for each tile request.",
        "Tiles are rendered in the browser using <strong>deck.gl</strong>, enabling smooth pan and zoom across the dataset.",
      ],
      beforeAfter: undefined,
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  if (pipeline === "vector-pmtiles") {
    const metadata: MetadataTileData[] = [
      {
        label: "Zoom Range",
        value:
          dataset.min_zoom != null && dataset.max_zoom != null
            ? `${dataset.min_zoom} – ${dataset.max_zoom}`
            : "—",
      },
      {
        label: "Tile Format",
        value: "MVT (Mapbox Vector Tiles)",
      },
    ];

    const tools: ToolCardData[] = [
      {
        name: "PMTiles",
        url: "https://protomaps.com/pmtiles",
        description:
          "Single-file archive format for pyramid vector tiles, served directly from object storage without a tile server.",
      },
      {
        name: "MapLibre GL JS",
        url: "https://maplibre.org/",
        description:
          "Open source map rendering library for the browser, used to display vector tiles with custom styles.",
      },
    ];

    return {
      label: "Display",
      subtitle: "map tiles",
      badge: "Step 4 of 4",
      title: "Served as dynamic vector map tiles from PMTiles",
      explanation: [
        "The <strong>PMTiles</strong> archive is read directly in the browser — no tile server required. The protocol handler fetches only the relevant byte ranges.",
        "Tiles are rendered with <strong>MapLibre GL JS</strong>, providing smooth vector map rendering with full style control.",
      ],
      beforeAfter: undefined,
      metadata,
      tools,
      toolSectionTitle: "Open source tools used",
    };
  }

  // vector-postgis
  const metadata: MetadataTileData[] = [
    {
      label: "Zoom Range",
      value:
        dataset.min_zoom != null && dataset.max_zoom != null
          ? `${dataset.min_zoom} – ${dataset.max_zoom}`
          : "—",
    },
    {
      label: "Tile Format",
      value: "MVT (Mapbox Vector Tiles)",
    },
  ];

  const tools: ToolCardData[] = [
    {
      name: "tipg",
      url: "https://developmentseed.org/tipg/",
      description:
        "OGC Features and Tiles API generating MVT tiles dynamically from PostGIS, supporting attribute filtering.",
    },
    {
      name: "MapLibre GL JS",
      url: "https://maplibre.org/",
      description:
        "Open source map rendering library for the browser, used to display vector tiles with custom styles.",
    },
  ];

  return {
    label: "Display",
    subtitle: "map tiles",
    badge: "Step 4 of 4",
    title: "Served as dynamic vector map tiles",
    explanation: [
      "<strong>tipg</strong> generates MVT vector tiles on demand from PostGIS, querying only the features visible in the current map viewport.",
      "Tiles are rendered in the browser with <strong>MapLibre GL JS</strong>, enabling interactive filtering and custom styling.",
    ],
    beforeAfter: undefined,
    metadata,
    tools,
    toolSectionTitle: "Open source tools used",
  };
}

export function getStepContent(dataset: Dataset, step: number): StepContent {
  const pipeline = getPipelineType(dataset);

  switch (step) {
    case 1:
      return getConvertStep(dataset, pipeline);
    case 2:
      return getCatalogStep(dataset, pipeline);
    case 3:
      return getStoreStep(dataset, pipeline);
    case 4:
      return getDisplayStep(dataset, pipeline);
    default:
      throw new Error(`Invalid step: ${step}`);
  }
}
