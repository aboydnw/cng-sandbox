import type { LayerConfig } from "./types";

/**
 * v1 terrain-vs-data policy: deck.gl overlays don't drape on MapLibre
 * terrain, so a chapter with any bound data layer may not enable terrain.
 * Globe is unrestricted and not covered here.
 */
export function chapterAllowsTerrain(
  layerConfig: LayerConfig | null | undefined
): boolean {
  if (!layerConfig) return true;
  return !layerConfig.dataset_id && !layerConfig.connection_id;
}
