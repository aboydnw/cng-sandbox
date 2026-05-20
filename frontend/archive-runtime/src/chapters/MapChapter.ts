import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import { PMTiles, Protocol } from "pmtiles";
import { tableFromIPC } from "apache-arrow";
import {
  GeoArrowSolidPolygonLayer,
  GeoArrowPathLayer,
  GeoArrowScatterplotLayer,
} from "@geoarrow/deck.gl-layers";

import type { MapChapterEntry, MapLayer, RasterLayer, VectorLayer } from "../types";
import { applyColormapToTile } from "../lib/rasterShader";
import { renderLegend } from "../Legend";

const BASEMAP_STYLES: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};
const DEFAULT_BASEMAP = "streets";

function basemapStyle(name: string): string {
  return BASEMAP_STYLES[name] ?? BASEMAP_STYLES[DEFAULT_BASEMAP];
}

let pmtilesProtocolRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  pmtilesProtocolRegistered = true;
}

function buildRasterLayer(layer: RasterLayer, basePath: string, chapterId: string) {
  const url = `${basePath}/chapters/${chapterId}/${layer.src}`;
  const pmt = new PMTiles(url);

  return new TileLayer({
    id: `raster-${layer.id}`,
    minZoom: 0,
    maxZoom: 24,
    tileSize: 256,
    // PMTiles must be read through the pmtiles client, not via the maplibre
    // `pmtiles://` protocol — deck.gl uses its own loader and does not honor
    // maplibre protocols.
    getTileData: async ({ index }) => {
      const { x, y, z } = index;
      const range = await pmt.getZxy(z, x, y);
      if (!range) return null;
      const blob = new Blob([range.data], { type: "image/png" });
      return await createImageBitmap(blob);
    },
    renderSubLayers: (props) => {
      const tile = props.tile as {
        boundingBox?: [[number, number], [number, number]];
        bbox?: { west: number; south: number; east: number; north: number };
      };
      const data = props.data as ImageBitmap | null;
      if (!data) return null;

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(data, 0, 0);
      const imageData = ctx.getImageData(0, 0, 256, 256);
      const out = applyColormapToTile(
        new Uint8ClampedArray(imageData.data),
        256,
        256,
        layer.rescale,
        layer.colormap,
      );
      ctx.putImageData(new ImageData(out, 256, 256), 0, 0);

      let bounds: [number, number, number, number];
      if (tile.boundingBox) {
        const [[west, south], [east, north]] = tile.boundingBox;
        bounds = [west, south, east, north];
      } else if (tile.bbox) {
        bounds = [tile.bbox.west, tile.bbox.south, tile.bbox.east, tile.bbox.north];
      } else {
        return null;
      }
      return new BitmapLayer({
        id: `${props.id}-bitmap`,
        image: canvas,
        bounds,
      });
    },
  });
}

async function buildVectorLayer(layer: VectorLayer, basePath: string, chapterId: string) {
  const url = `${basePath}/chapters/${chapterId}/${layer.src}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`vector fetch failed: ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const table = tableFromIPC(bytes);
  const fill = (layer.style.fill as [number, number, number, number?]) ?? [200, 200, 200, 180];
  const stroke = (layer.style.stroke as [number, number, number, number?]) ?? [50, 50, 50, 255];

  if (layer.geom === "polygon") {
    return new GeoArrowSolidPolygonLayer({
      id: `vector-${layer.id}`,
      data: table,
      getFillColor: fill,
      getLineColor: stroke,
    });
  }
  if (layer.geom === "line") {
    return new GeoArrowPathLayer({
      id: `vector-${layer.id}`,
      data: table,
      getColor: stroke,
      widthMinPixels: 1,
    });
  }
  return new GeoArrowScatterplotLayer({
    id: `vector-${layer.id}`,
    data: table,
    getFillColor: fill,
    radiusUnits: "pixels",
    getRadius: 4,
  });
}

export async function renderMapChapter(
  chapter: MapChapterEntry,
  host: HTMLElement,
  basePath: string,
): Promise<void> {
  ensurePmtilesProtocol();
  const section = document.createElement("section");
  section.className = "chapter map";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }

  const mapEl = document.createElement("div");
  mapEl.className = "map-container";
  section.appendChild(mapEl);

  host.appendChild(section);

  const map = new MaplibreMap({
    container: mapEl,
    style: basemapStyle(chapter.basemap),
    center: chapter.camera.center,
    zoom: chapter.camera.zoom,
    bearing: chapter.camera.bearing ?? 0,
    pitch: chapter.camera.pitch ?? 0,
    interactive: true,
  });

  const layerObjects = await Promise.all(
    chapter.layers.map((l: MapLayer) => {
      if (l.kind === "raster") return buildRasterLayer(l, basePath, chapter.id);
      return buildVectorLayer(l, basePath, chapter.id);
    }),
  );

  const overlay = new MapboxOverlay({ layers: layerObjects });
  map.addControl(overlay as unknown as maplibregl.IControl);

  const legendEl = renderLegend(chapter.legend);
  if (legendEl) section.appendChild(legendEl);

  if (chapter.narrative) {
    const body = document.createElement("div");
    body.className = "chapter-body";
    body.innerHTML = chapter.narrative;
    section.appendChild(body);
  }
}
