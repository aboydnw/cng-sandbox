import type { ConnectionType } from "../../types";

export function detectConnectionType(url: string): ConnectionType | null {
  // Strip query string for extension matching
  const path = url.split("?")[0].toLowerCase();
  const trimmed = path.replace(/\/$/, "");

  if (trimmed.endsWith(".tif") || trimmed.endsWith(".tiff")) {
    return "cog";
  }
  if (trimmed.endsWith(".pmtiles")) {
    return "pmtiles";
  }
  if (trimmed.endsWith(".laz")) {
    return "copc";
  }
  if (trimmed.endsWith(".zarr")) {
    return "zarr";
  }
  if (url.includes("{z}") && url.includes("{x}") && url.includes("{y}")) {
    if (path.endsWith(".mvt") || path.endsWith(".pbf")) {
      return "xyz_vector";
    }
    return "xyz_raster";
  }
  return null;
}

export function extractNameFromUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);

    // If the original URL has XYZ placeholders, use hostname instead
    if (url.includes("{z}") && url.includes("{x}") && url.includes("{y}")) {
      return parsed.hostname;
    }

    const path = parsed.pathname.split("?")[0];
    const filename = path.split("/").pop() || "";

    if (!filename || filename === "/") {
      return parsed.hostname;
    }
    return filename;
  } catch {
    return "";
  }
}
