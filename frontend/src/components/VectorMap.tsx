import { useEffect, useRef, useCallback } from "react";
import { Box, NativeSelect } from "@chakra-ui/react";
import maplibregl, { addProtocol, removeProtocol } from "maplibre-gl";
import { createPMTilesProtocol } from "../lib/maptool";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const FILL_COLOR = "#CF3F02";
const LINE_COLOR = "#CF3F02";
const CIRCLE_COLOR = "#CF3F02";

interface VectorMapProps {
  dataset: Dataset;
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  onViewportChange?: (viewport: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }) => void;
}

export function VectorMap({ dataset, basemap, onBasemapChange, onViewportChange }: VectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const isPMTiles = dataset.tile_url.startsWith("/pmtiles/");

  const addVectorLayers = useCallback((map: maplibregl.Map) => {
    // Remove any existing layers/source before re-adding (defensive against
    // setStyle({ diff: true }) retaining custom sources across style swaps).
    ["vector-fill", "vector-line", "vector-circle"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource("vector-data")) map.removeSource("vector-data");

    if (isPMTiles) {
      const pmtilesUrl = `pmtiles://${window.location.origin}${dataset.tile_url}`;
      map.addSource("vector-data", {
        type: "vector",
        url: pmtilesUrl,
      });
    } else {
      const tileUrl = dataset.tile_url.startsWith("/")
        ? `${window.location.origin}${dataset.tile_url}`
        : dataset.tile_url;
      map.addSource("vector-data", {
        type: "vector",
        tiles: [tileUrl],
      });
    }

    map.addLayer({
      id: "vector-fill",
      type: "fill",
      source: "vector-data",
      "source-layer": "default",
      paint: { "fill-color": FILL_COLOR, "fill-opacity": 0.3 },
    });

    map.addLayer({
      id: "vector-line",
      type: "line",
      source: "vector-data",
      "source-layer": "default",
      paint: { "line-color": LINE_COLOR, "line-width": 1.5 },
    });

    map.addLayer({
      id: "vector-circle",
      type: "circle",
      source: "vector-data",
      "source-layer": "default",
      paint: {
        "circle-color": CIRCLE_COLOR,
        "circle-radius": 4,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1,
      },
    });

    map.on("click", ["vector-fill", "vector-line", "vector-circle"], (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const container = document.createElement("div");
      for (const [k, v] of Object.entries(props)) {
        const row = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = k + ": ";
        row.appendChild(label);
        row.appendChild(document.createTextNode(String(v)));
        container.appendChild(row);
      }
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    });

    map.on("mouseenter", "vector-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "vector-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  }, [dataset.tile_url, isPMTiles]);

  // Ref so the basemap effect always calls the latest addVectorLayers without
  // needing it as a dependency (which would cause spurious setStyle calls on
  // dataset changes).
  const addVectorLayersRef = useRef(addVectorLayers);
  useEffect(() => {
    addVectorLayersRef.current = addVectorLayers;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Register pmtiles protocol before map creation when serving PMTiles.
    // Use protocol.tile directly — pmtiles-js uses arrow functions, no .bind() needed.
    let pmtilesCleanup: (() => void) | null = null;
    if (isPMTiles) {
      const { protocol, cleanup } = createPMTilesProtocol();
      addProtocol("pmtiles", protocol.tile);
      pmtilesCleanup = cleanup;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[basemap],
      center: dataset.bounds
        ? [(dataset.bounds[0] + dataset.bounds[2]) / 2, (dataset.bounds[1] + dataset.bounds[3]) / 2]
        : [0, 0],
      zoom: dataset.bounds ? 3 : 2,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      addVectorLayersRef.current(map);

      if (dataset.bounds) {
        map.fitBounds(
          [
            [dataset.bounds[0], dataset.bounds[1]],
            [dataset.bounds[2], dataset.bounds[3]],
          ],
          { padding: 40, animate: false },
        );
      }
    });

    map.on("moveend", () => {
      if (onViewportChange) {
        const center = map.getCenter();
        onViewportChange({
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
      }
    });

    mapRef.current = map;
    return () => {
      if (isPMTiles) {
        removeProtocol("pmtiles");
        pmtilesCleanup?.();
      }
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  // Handle basemap changes. Only depends on [basemap] — addVectorLayers is
  // accessed via ref to avoid spurious runs when dataset changes.
  // isStyleLoaded() guards against the initial mount (map not yet loaded).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // diff: false ensures custom sources are fully cleared before re-adding.
    map.setStyle(BASEMAPS[basemap], { diff: false });
    map.once("style.load", () => {
      addVectorLayersRef.current(map);
    });
  }, [basemap]);

  return (
    <Box position="relative" w="100%" h="100%">
      <Box ref={containerRef} w="100%" h="100%" />
      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect.Root size="xs">
          <NativeSelect.Field
            value={basemap}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onBasemapChange(e.target.value)}
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="dark">Dark</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>
    </Box>
  );
}
