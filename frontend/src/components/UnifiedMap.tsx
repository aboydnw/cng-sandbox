import { forwardRef, useCallback, useMemo, useRef } from "react";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHover?: (info: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (info: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTooltip?: (info: any) => any;
  children?: React.ReactNode;
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
  interactive?: boolean;
  onTransitionEnd?: () => void;
  hideBasemapPicker?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef?: React.Ref<any>;
  enableSnapshot?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    onTransitionEnd,
    hideBasemapPicker = false,
    mapRef,
    enableSnapshot,
  },
  ref
) {
  const wasTransitioningRef = useRef(false);

  const handleViewStateChange = useCallback(
    ({
      viewState,
      interactionState,
    }: {
      viewState: {
        longitude: number;
        latitude: number;
        zoom: number;
        bearing?: number;
        pitch?: number;
      };
      interactionState?: { inTransition?: boolean };
    }) => {
      onCameraChange({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
        pitch: viewState.pitch ?? 0,
      });

      const isTransitioning = interactionState?.inTransition ?? false;
      if (wasTransitioningRef.current && !isTransitioning && onTransitionEnd) {
        onTransitionEnd();
      }
      wasTransitioningRef.current = isTransitioning;
    },
    [onCameraChange, onTransitionEnd]
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
        controller={
          interactive
            ? { dragRotate: true }
            : {
                dragPan: false,
                dragRotate: false,
                scrollZoom: false,
                doubleClickZoom: false,
                touchZoom: false,
                touchRotate: false,
                keyboard: false,
              }
        }
        layers={layers}
        views={views}
        onHover={onHover}
        onClick={onClick}
        getTooltip={getTooltip}
      >
        <Map
          ref={mapRef}
          mapStyle={BASEMAPS[basemap]}
          longitude={camera.longitude}
          latitude={camera.latitude}
          zoom={camera.zoom}
          bearing={camera.bearing}
          pitch={camera.pitch}
          // @ts-expect-error preserveDrawingBuffer removed from MapOptions types in maplibre-gl v5
          preserveDrawingBuffer={enableSnapshot ?? false}
        />
      </DeckGL>

      {interactive && !hideBasemapPicker && (
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
      )}

      {children}
    </Box>
  );
});
