import { useState, useEffect, useMemo } from "react";
import type { MapItem } from "../types";
import { formatBytes } from "../utils/format";
import { evaluateClientRenderEligibility } from "../lib/layers/clientRenderEligibility";

export type RenderMode = "server" | "client" | "vector-tiles" | "geojson";

interface BandInfo {
  name: string;
  index: number;
}

export interface InitialRasterOverrides {
  itemId: string;
  rescaleMin: number | null;
  rescaleMax: number | null;
  colormapReversed: boolean;
  colormapName?: string;
  renderMode?: RenderMode;
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
  isCategorical: boolean;
  categoricalOverride: boolean | null;
  setCategoricalOverride: (v: boolean | null) => void;
  showingColormap: boolean;
  canClientRender: boolean;
  clientRenderDisabledReason: string | null;
  rescaleMin: number | null;
  rescaleMax: number | null;
  setRescale: (min: number | null, max: number | null) => void;
  colormapReversed: boolean;
  setColormapReversed: (v: boolean) => void;
}

export function useMapControls(
  item: MapItem | null,
  initialOverrides?: InitialRasterOverrides
): UseMapControlsResult {
  const seedMatches =
    !!initialOverrides && item?.id === initialOverrides.itemId;

  const [opacity, setOpacity] = useState(0.8);
  const [colormapName, setColormapName] = useState(
    seedMatches ? (initialOverrides!.colormapName ?? "viridis") : "viridis"
  );
  const [selectedBand, setSelectedBand] = useState<"rgb" | number>("rgb");
  const [renderMode, setRenderMode] = useState<RenderMode>("server");
  const [categoricalOverride, setCategoricalOverride] = useState<
    boolean | null
  >(null);
  const [rescaleMin, setRescaleMin] = useState<number | null>(
    seedMatches ? initialOverrides!.rescaleMin : null
  );
  const [rescaleMax, setRescaleMax] = useState<number | null>(
    seedMatches ? initialOverrides!.rescaleMax : null
  );
  const [colormapReversed, setColormapReversed] = useState<boolean>(
    seedMatches ? initialOverrides!.colormapReversed : false
  );

  const eligibility = useMemo(
    () => evaluateClientRenderEligibility(item ?? null),
    [item]
  );

  useEffect(() => {
    setOpacity(0.8);
    setSelectedBand("rgb");
    setCategoricalOverride(null);
    if (initialOverrides && item?.id === initialOverrides.itemId) {
      setColormapName(initialOverrides.colormapName ?? "viridis");
      setRescaleMin(initialOverrides.rescaleMin);
      setRescaleMax(initialOverrides.rescaleMax);
      setColormapReversed(initialOverrides.colormapReversed);
      if (item?.dataType === "vector") {
        setRenderMode("vector-tiles");
      } else if (
        initialOverrides.renderMode === "client" ||
        initialOverrides.renderMode === "server"
      ) {
        setRenderMode(initialOverrides.renderMode);
      } else if (eligibility.canRender) {
        setRenderMode("client");
      } else {
        setRenderMode("server");
      }
    } else {
      setColormapName("viridis");
      setRescaleMin(null);
      setRescaleMax(null);
      setColormapReversed(false);
      if (item?.dataType === "vector") {
        setRenderMode("vector-tiles");
      } else if (eligibility.canRender) {
        setRenderMode("client");
      } else {
        setRenderMode("server");
      }
    }
  }, [item?.id, item?.dataType]);

  const setRescale = (min: number | null, max: number | null) => {
    setRescaleMin(min);
    setRescaleMax(max);
  };

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

  const isCategorical =
    categoricalOverride !== null ? categoricalOverride : !!item?.isCategorical;

  const showingColormap =
    !isCategorical &&
    (isSingleBand || (isMultiBand && effectiveBand !== "rgb"));

  const canClientRender = eligibility.canRender;

  const clientRenderDisabledReason = (() => {
    if (eligibility.canRender) return null;
    if (!item?.cogUrl) return null;
    if (item.source === "connection" && eligibility.sizeBytes == null) {
      return "File size unavailable; client render can't be enabled safely";
    }
    if (eligibility.sizeBytes != null && eligibility.cap != null) {
      return `File exceeds ${formatBytes(eligibility.cap)} browser limit (${formatBytes(eligibility.sizeBytes)})`;
    }
    return null;
  })();

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
    isCategorical,
    categoricalOverride,
    setCategoricalOverride,
    showingColormap,
    canClientRender,
    clientRenderDisabledReason,
    rescaleMin,
    rescaleMax,
    setRescale,
    colormapReversed,
    setColormapReversed,
  };
}
