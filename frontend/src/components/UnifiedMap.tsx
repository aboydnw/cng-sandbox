import { forwardRef, useCallback, useMemo } from "react";
import { Box } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, FlyToInterpolator } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import type { Layer } from "@deck.gl/core";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, GeoJsonLayer } from "@deck.gl/layers";
import type { CameraState } from "../lib/layers/types";
import { BASEMAPS, BasemapPicker } from "./MapShell";

interface UnifiedMapProps {
  camera: CameraState;
  onCameraChange: (camera: CameraState) => void;
  layers: Layer[];
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
  getTooltip?: (info: any) => any;
  children?: React.ReactNode;
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
  interactive?: boolean;
  externalTileUrl?: string | null;
  footprintGeometry?: GeoJSON.Geometry | null;
}

export const UnifiedMap = forwardRef<any, UnifiedMapProps>(function UnifiedMap(
  {
    camera,
    onCameraChange,
    layers,
    basemap,
    onBasemapChange,
    onHover,
    onClick,
    getTooltip,
    children,
    transitionDuration,
    transitionInterpolator,
    interactive = true,
    externalTileUrl,
    footprintGeometry,
  },
  ref,
) {
  const handleViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      onCameraChange({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
        pitch: viewState.pitch ?? 0,
      });
    },
    [onCameraChange],
  );

  const externalLayers = useMemo(() => {
    const extra: Layer[] = [];
    if (externalTileUrl) {
      extra.push(
        new TileLayer({
          id: "external-tile-layer",
          data: externalTileUrl,
          minZoom: 0,
          maxZoom: 22,
          tileSize: 256,
          renderSubLayers: (props: any) => {
            const { boundingBox } = props.tile;
            return new BitmapLayer(props, {
              data: undefined,
              image: props.data,
              bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
            });
          },
        }),
      );
    }
    if (footprintGeometry) {
      extra.push(
        new GeoJsonLayer({
          id: "footprint-highlight",
          data: {
            type: "FeatureCollection",
            features: [{ type: "Feature", geometry: footprintGeometry, properties: {} }],
          },
          getFillColor: [255, 140, 0, 40],
          getLineColor: [255, 140, 0, 200],
          getLineWidth: 2,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: false,
        }),
      );
    }
    return extra;
  }, [externalTileUrl, footprintGeometry]);

  const allLayers = useMemo(
    () => [...layers, ...externalLayers],
    [layers, externalLayers],
  );

  const views = useMemo(() => new MapView({ repeat: true }), []);

  const viewState = transitionDuration
    ? { ...camera, transitionDuration, transitionInterpolator }
    : camera;

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        ref={ref}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={interactive ? { dragRotate: true } : false}
        layers={allLayers}
        views={views}
        onHover={onHover}
        onClick={onClick}
        getTooltip={getTooltip}
      >
        <Map
          mapStyle={BASEMAPS[basemap]}
          longitude={camera.longitude}
          latitude={camera.latitude}
          zoom={camera.zoom}
          bearing={camera.bearing}
          pitch={camera.pitch}
        />
      </DeckGL>

      <Box
        position="absolute"
        top={3}
        left={3}
        bg="white"
        borderRadius="4px"
        shadow="sm"
        p={1}
      >
        <BasemapPicker value={basemap} onChange={onBasemapChange} />
      </Box>

      {children}
    </Box>
  );
});
