import { forwardRef, useCallback, useMemo } from "react";
import { Box } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, FlyToInterpolator } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import type { Layer } from "@deck.gl/core";
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
  },
  ref
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
    [onCameraChange]
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
        layers={layers}
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
