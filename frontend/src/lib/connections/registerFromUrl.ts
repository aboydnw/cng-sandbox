import { connectionsApi } from "../api";
import type { Connection } from "../../types";
import { extractNameFromUrl } from "./detect";
import { probeCOG, probePMTiles } from "./probe";

/**
 * Probe a PMTiles URL for its header metadata and register it as a connection.
 * Mirrors the logic in `InlineConnectionForm.handleSave` for pmtiles; if
 * probing fails the connection is still created with null metadata (probe
 * errors are swallowed, not propagated).
 */
export async function registerPMTilesConnection(
  url: string
): Promise<Connection> {
  let metadata = null;
  try {
    metadata = await probePMTiles(url);
  } catch {
    // Probe failures are non-fatal — registration can proceed with null metadata
  }

  return connectionsApi.create({
    name: extractNameFromUrl(url) || "Untitled",
    url,
    connection_type: "pmtiles",
    bounds: metadata?.bounds ?? null,
    min_zoom: metadata?.minZoom ?? null,
    max_zoom: metadata?.maxZoom ?? null,
    tile_type: metadata?.tileType ?? "vector",
    band_count: metadata?.bandCount ?? null,
    rescale: metadata?.rescale ? metadata.rescale.join(",") : null,
  });
}

/**
 * Probe a COG URL for its tilejson/info metadata and register it as a
 * connection. Same fallback semantics as `registerPMTilesConnection`.
 */
export async function registerCogConnection(url: string): Promise<Connection> {
  let metadata = null;
  try {
    metadata = await probeCOG(url);
  } catch {
    // Probe failures are non-fatal
  }

  return connectionsApi.create({
    name: extractNameFromUrl(url) || "Untitled",
    url,
    connection_type: "cog",
    bounds: metadata?.bounds ?? null,
    min_zoom: metadata?.minZoom ?? null,
    max_zoom: metadata?.maxZoom ?? null,
    tile_type: metadata?.tileType ?? "raster",
    band_count: metadata?.bandCount ?? null,
    rescale: metadata?.rescale ? metadata.rescale.join(",") : null,
  });
}
