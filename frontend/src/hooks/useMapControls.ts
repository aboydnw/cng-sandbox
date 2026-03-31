import { useState, useEffect, useMemo } from "react";
import type { MapItem } from "../types";
import { formatBytes } from "../utils/format";

const CLIENT_RENDER_MAX_BYTES = 200 * 1024 * 1024; // 200MB

export type RenderMode = "server" | "client" | "vector-tiles" | "geojson";

interface BandInfo {
  name: string;
  index: number;
}

interface UseMapControlsResult {
  opacity: number;
  setOpacity: (v: number) => void;
  colormapName: string;
  setColormapName: (v: string) => void;
  selectedBand: "rgb" | number;
  setSelectedBand: (v: "rgb" | number) => void;
  renderMode: RenderMode;
  setRenderMode: (v: RenderMode) => void;
  isSingleBand: boolean;
  isMultiBand: boolean;
  hasRgb: boolean;
  selectableBands: BandInfo[];
  effectiveBand: "rgb" | number;
  showingColormap: boolean;
  canClientRender: boolean;
  clientRenderDisabledReason: string | null;
}

export function useMapControls(item: MapItem | null): UseMapControlsResult {
  const [opacity, setOpacity] = useState(0.8);
  const [colormapName, setColormapName] = useState("viridis");
  const [selectedBand, setSelectedBand] = useState<"rgb" | number>("rgb");
  const [renderMode, setRenderMode] = useState<RenderMode>("server");

  useEffect(() => {
    setOpacity(0.8);
    setColormapName("viridis");
    setSelectedBand("rgb");
    setRenderMode(item?.dataType === "vector" ? "vector-tiles" : "server");
  }, [item?.id, item?.dataType]);

  const isSingleBand = item?.bandCount === 1;
  const isMultiBand = (item?.bandCount ?? 0) > 1;

  const ci = item?.colorInterpretation ?? [];
  const hasRgb =
    ci.length >= 3 && ci[0] === "red" && ci[1] === "green" && ci[2] === "blue";

  const selectableBands = useMemo(
    () =>
      (item?.bandNames ?? [])
        .map((name, i) => ({ name, index: i }))
        .filter((_, i) => ci[i] !== "alpha"),
    [item?.bandNames, ci]
  );

  const effectiveBand =
    isMultiBand && !hasRgb && selectedBand === "rgb" ? 0 : selectedBand;

  const showingColormap =
    isSingleBand || (isMultiBand && effectiveBand !== "rgb");

  const canClientRender =
    !!item &&
    !item.isTemporal &&
    !!item.cogUrl &&
    !!item.bounds &&
    Math.abs(item.bounds[1]) < 85.05 &&
    Math.abs(item.bounds[3]) < 85.05 &&
    (item.dataset?.converted_file_size ?? 0) < CLIENT_RENDER_MAX_BYTES;

  const clientRenderDisabledReason =
    item?.cogUrl &&
    item?.dataset?.converted_file_size != null &&
    item.dataset.converted_file_size >= CLIENT_RENDER_MAX_BYTES
      ? `File exceeds 200 MB browser limit (${formatBytes(item.dataset.converted_file_size)})`
      : null;

  return {
    opacity,
    setOpacity,
    colormapName,
    setColormapName,
    selectedBand,
    setSelectedBand,
    renderMode,
    setRenderMode,
    isSingleBand,
    isMultiBand,
    hasRgb,
    selectableBands,
    effectiveBand,
    showingColormap,
    canClientRender,
    clientRenderDisabledReason,
  };
}
