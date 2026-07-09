import { Marker } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

export interface Highlight {
  id: string;
  longitude: number;
  latitude: number;
  label: string;
}

/** A live marker on the map that can be torn down. */
export interface MarkerHandle {
  remove(): void;
}

export type MarkerFactory = (highlight: Highlight) => MarkerHandle;

/**
 * Build the DOM element for an agent highlight marker: a warm brand-orange
 * pin dot with a label above it. Rendered by maplibre as a `Marker`, which
 * tracks terrain elevation natively (unlike deck.gl, which draws at ellipsoid
 * height and sinks below elevated peaks).
 */
export function createHighlightElement(label: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "cng-agent-highlight";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";

  const text = document.createElement("span");
  text.textContent = label;
  text.style.marginBottom = "4px";
  text.style.padding = "2px 8px";
  text.style.borderRadius = "6px";
  text.style.fontFamily = "system-ui, sans-serif";
  text.style.fontSize = "13px";
  text.style.fontWeight = "600";
  text.style.whiteSpace = "nowrap";
  text.style.color = "#3c281e";
  text.style.background = "rgba(255, 255, 255, 0.9)";
  text.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.25)";

  const dot = document.createElement("div");
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "50%";
  dot.style.background = "#e87a2e";
  dot.style.border = "2px solid #ffffff";
  dot.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.4)";

  el.append(text, dot);
  return el;
}

/**
 * Create a maplibre `Marker` for a highlight, anchored so its dot sits on the
 * point. The marker follows terrain elevation automatically.
 */
export function createHighlightMarker(
  map: MapLibreMap,
  highlight: Highlight
): MarkerHandle {
  const marker = new Marker({
    element: createHighlightElement(highlight.label),
    anchor: "bottom",
  })
    .setLngLat([highlight.longitude, highlight.latitude])
    .addTo(map);
  return { remove: () => marker.remove() };
}

/**
 * Reconcile the set of live markers against the desired highlights: remove
 * markers whose highlight is gone (e.g. after the auto-remove timeout) and add
 * markers for highlights that don't have one yet. Idempotent.
 */
export function reconcileHighlightMarkers(
  highlights: Highlight[],
  registry: Map<string, MarkerHandle>,
  create: MarkerFactory
): void {
  const wanted = new Set(highlights.map((h) => h.id));
  for (const [id, handle] of registry) {
    if (!wanted.has(id)) {
      handle.remove();
      registry.delete(id);
    }
  }
  for (const highlight of highlights) {
    if (!registry.has(highlight.id)) {
      registry.set(highlight.id, create(highlight));
    }
  }
}
