import type { Layer } from "@deck.gl/core";
import type { MapItem } from "../../types";
import type { LutCategory } from "./categoricalLut";
import {
  evaluateClientRenderEligibility,
  type ClientRenderEligibility,
} from "./clientRenderEligibility";
import { buildCogLayerContinuous, buildCogLayerPaletted } from "./cogLayer";
import { buildRasterTileLayers } from "./rasterTileLayer";
import { parseRescaleString } from "../connections/rescale";

export interface ResolveRasterLayersInput {
  item: MapItem | null;
  opacity: number;
  rescaleMin: number | null;
  rescaleMax: number | null;
  serverTileUrl?: string;
  effectiveCategories?: LutCategory[];
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
    serverTileUrl,
    effectiveCategories,
  } = input;

  if (!item) {
    return {
      layers: [],
      renderMode: "server",
      reason: evaluateClientRenderEligibility(null).reason,
      sizeBytes: null,
      cap: null,
    };
  }

  const eligibility: ClientRenderEligibility =
    evaluateClientRenderEligibility(item);

  if (eligibility.canRender && item.cogUrl) {
    let layers;
    if (eligibility.renderPath === "paletted") {
      layers = buildCogLayerPaletted({
        cogUrl: item.cogUrl,
        opacity,
        categories: effectiveCategories,
      });
    } else {
      const parsed = parseRescaleString(item.rescale);
      layers = buildCogLayerContinuous({
        cogUrl: item.cogUrl,
        opacity,
        rasterMin: rescaleMin ?? parsed?.min ?? item.rasterMin ?? 0,
        rasterMax: rescaleMax ?? parsed?.max ?? item.rasterMax ?? 1,
      });
    }
    return {
      layers,
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
    layers,
    renderMode: "server",
    reason: eligibility.reason,
    sizeBytes: eligibility.sizeBytes,
    cap: eligibility.cap,
  };
}
