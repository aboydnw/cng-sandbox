import { useMemo, useCallback } from "react";
import { Box, NativeSelect } from "@chakra-ui/react";
import { DeckGL } from "@deck.gl/react";
import { MapView } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { Table } from "apache-arrow";
import type { MapViewState } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const FILL_COLOR = [207, 63, 2, 180] as [number, number, number, number];
const LINE_COLOR = [207, 63, 2, 255] as [number, number, number, number];

interface DuckDBMapProps {
  table: Table | null;
  viewState: MapViewState;
  onViewStateChange: (vs: MapViewState) => void;
  basemap: string;
  onBasemapChange: (basemap: string) => void;
}

function arrowTableToGeoJSON(table: Table): GeoJSON.FeatureCollection {
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

export function DuckDBMap({
  table,
  viewState,
  onViewStateChange,
  basemap,
  onBasemapChange,
}: DuckDBMapProps) {
  const geojson = useMemo(() => {
    if (!table || table.numRows === 0) return null;
    return arrowTableToGeoJSON(table);
  }, [table]);

  const layers = useMemo(() => {
    if (!geojson || geojson.features.length === 0) return [];
    return [
      new GeoJsonLayer({
        id: "duckdb-geojson",
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
  }, [geojson]);

  const onHover = useCallback((info: { object?: unknown }) => {
    // Could add tooltip here later
  }, []);

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => onViewStateChange(vs as MapViewState)}
        controller
        layers={layers}
        onHover={onHover}
        views={new MapView({ repeat: true })}
        getTooltip={({ object }: { object?: Record<string, unknown> }) => {
          if (!object) return null;
          const props = Object.entries(object)
            .filter(([k]) => k !== "geometry" && k !== "geom")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
          return { text: props, style: { fontSize: "12px" } };
        }}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>
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
