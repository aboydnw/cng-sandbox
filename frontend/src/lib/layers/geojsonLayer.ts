import { GeoJsonLayer } from "@deck.gl/layers";
import { BRAND_COLOR_RGBA } from "../../components/MapShell";
import type { Table } from "apache-arrow";

const FILL_COLOR = [...BRAND_COLOR_RGBA, 180] as [
  number,
  number,
  number,
  number,
];
const LINE_COLOR = [...BRAND_COLOR_RGBA, 255] as [
  number,
  number,
  number,
  number,
];

export function arrowTableToGeoJSON(table: Table): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const row = table.get(i);
    if (!row) continue;
    const geojsonStr = row.__geojson;
    if (!geojsonStr) continue;
    const properties: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      if (field.name === "__geojson") continue;
      properties[field.name] = row[field.name];
    }
    features.push({
      type: "Feature",
      geometry: JSON.parse(geojsonStr),
      properties,
    });
  }
  return { type: "FeatureCollection", features };
}

interface GeoJsonLayerOptions {
  geojson: GeoJSON.FeatureCollection | null;
}

export function buildGeoJsonLayer({ geojson }: GeoJsonLayerOptions) {
  if (!geojson || geojson.features.length === 0) return [];

  return [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: geojson,
      getFillColor: FILL_COLOR,
      getLineColor: LINE_COLOR,
      getLineWidth: 1.5,
      lineWidthMinPixels: 1,
      getPointRadius: 4,
      pointRadiusMinPixels: 3,
      stroked: true,
      filled: true,
      pickable: true,
    }),
  ];
}
