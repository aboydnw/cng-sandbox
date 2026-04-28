import type { MapItem } from "../../types";
import { classifyCogRenderPath } from "./cogDtype";

export const CLIENT_RENDER_MAX_BYTES_PALETTED = 2 * 1024 * 1024 * 1024; // 2 GB
export const CLIENT_RENDER_MAX_BYTES_CONTINUOUS = 500 * 1024 * 1024; // 500 MB

export type CogRenderPath = "paletted" | "continuous";

export interface ClientRenderEligibility {
  canRender: boolean;
  renderPath: CogRenderPath | null;
  sizeBytes: number | null;
  cap: number | null;
  reason: string;
}

export function evaluateClientRenderEligibility(
  item: MapItem | null
): ClientRenderEligibility {
  if (!item) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "No item provided",
    };
  }

  if (item.isTemporal) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "Temporal dataset requires server-side tiling",
    };
  }

  if (!item.cogUrl) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "No COG URL available for client rendering",
    };
  }

  if (!item.bounds) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "Bounds unavailable",
    };
  }

  if (Math.abs(item.bounds[1]) >= 85.05 || Math.abs(item.bounds[3]) >= 85.05) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "Bounds exceed supported latitude range (±85.05°)",
    };
  }

  if (item.bandCount !== null && item.bandCount > 1) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "Multi-band COG requires server-side rendering",
    };
  }

  const sizeBytes =
    item.dataset?.converted_file_size ?? item.connection?.file_size ?? null;

  if (item.source === "connection" && sizeBytes == null) {
    return {
      canRender: false,
      renderPath: null,
      sizeBytes: null,
      cap: null,
      reason: "Connection file size unknown",
    };
  }

  const renderPath = classifyCogRenderPath({
    dtype: item.dtype,
    isCategorical: !!item.isCategorical,
  });
  const cap =
    renderPath === "paletted"
      ? CLIENT_RENDER_MAX_BYTES_PALETTED
      : CLIENT_RENDER_MAX_BYTES_CONTINUOUS;

  if ((sizeBytes ?? 0) > cap) {
    const capLabel = renderPath === "paletted" ? "2 GB" : "500 MB";
    return {
      canRender: false,
      renderPath,
      sizeBytes,
      cap,
      reason: `File exceeds ${capLabel} client-render cap`,
    };
  }

  const capLabel = renderPath === "paletted" ? "2 GB" : "500 MB";
  return {
    canRender: true,
    renderPath,
    sizeBytes,
    cap,
    reason: `COG under ${capLabel} cap`,
  };
}
