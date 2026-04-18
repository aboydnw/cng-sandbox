import type { MutableRefObject } from "react";
import type { Layer } from "@deck.gl/core";
import type { MapItem } from "../../types";
import type { TileCacheEntry } from "./cogLayer";
import {
  evaluateClientRenderEligibility,
  type ClientRenderEligibility,
} from "./clientRenderEligibility";
import { buildCogLayerContinuous, buildCogLayerPaletted } from "./cogLayer";
import { buildRasterTileLayers } from "./rasterTileLayer";

export interface ResolveRasterLayersInput {
  item: MapItem | null;
  opacity: number;
  rescaleMin: number | null;
  rescaleMax: number | null;
  tileCacheRef: MutableRefObject<Map<string, TileCacheEntry>>;
  serverTileUrl?: string;
  effectiveCategories?: { value: number; color: string; label: string }[];
}

export interface ResolveRasterLayersOutput {
  layers: Layer[];
  renderMode: "client" | "server";
  reason: string;
  sizeBytes: number | null;
  cap: number | null;
}

export function resolveRasterLayers(
  input: ResolveRasterLayersInput
): ResolveRasterLayersOutput {
  const {
    item,
    opacity,
    rescaleMin,
    rescaleMax,
    tileCacheRef,
    serverTileUrl,
    effectiveCategories,
  } = input;

  if (!item) {
    return {
      layers: [],
      renderMode: "server",
      reason: "No item",
      sizeBytes: null,
      cap: null,
    };
  }

  const eligibility: ClientRenderEligibility =
    evaluateClientRenderEligibility(item);

  if (eligibility.canRender && item.cogUrl) {
    const layers =
      eligibility.renderPath === "paletted"
        ? buildCogLayerPaletted({
            cogUrl: item.cogUrl,
            opacity,
            categories: effectiveCategories,
            tileCacheRef,
            datasetBounds: item.bounds,
          })
        : buildCogLayerContinuous({
            cogUrl: item.cogUrl,
            opacity,
            rasterMin: rescaleMin ?? item.rasterMin ?? 0,
            rasterMax: rescaleMax ?? item.rasterMax ?? 1,
            datasetBounds: item.bounds,
            tileCacheRef,
          });
    return {
      layers: layers as unknown as Layer[],
      renderMode: "client",
      reason: eligibility.reason,
      sizeBytes: eligibility.sizeBytes,
      cap: eligibility.cap,
    };
  }

  const tileUrl = serverTileUrl ?? item.tileUrl;
  const layers = buildRasterTileLayers({
    tileUrl,
    opacity,
    isTemporalActive: false,
  });
  return {
    layers: layers as unknown as Layer[],
    renderMode: "server",
    reason: eligibility.reason,
    sizeBytes: eligibility.sizeBytes,
    cap: eligibility.cap,
  };
}
