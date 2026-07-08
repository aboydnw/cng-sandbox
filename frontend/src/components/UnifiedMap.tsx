import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Box } from "@chakra-ui/react";
import { Map, useControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Layer, PickingInfo } from "@deck.gl/core";
import type { CameraState } from "../lib/layers/types";
import type { TerrainState } from "../lib/story/types";
import { resolveCameraCommand } from "./mapCamera";
import { apply3D, bindStyleReapply } from "../lib/layers/apply3D";
import { BASEMAPS, BasemapPicker } from "./MapShell";

// Mirrors deck.gl's TooltipContent, which is not exported from
// @deck.gl/core's package entry point.
type TooltipContent =
  | null
  | string
  | {
      text?: string;
      html?: string;
      className?: string;
      style?: Partial<CSSStyleDeclaration>;
    };

interface UnifiedMapProps {
  camera: CameraState;
  onCameraChange: (camera: CameraState) => void;
  layers: Layer[];
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;
  getTooltip?: (info: PickingInfo) => TooltipContent;
  children?: React.ReactNode;
  transitionDuration?: number;
  interactive?: boolean;
  onTransitionEnd?: () => void;
  hideBasemapPicker?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef?: React.Ref<any>;
  enableSnapshot?: boolean;
  onAfterRender?: () => void;
  terrain?: TerrainState;
  globe?: boolean;
  buildings?: boolean;
  allowTerrain?: boolean;
}

interface DeckOverlayHandle {
  deck?: { canvas?: HTMLCanvasElement; redraw?: (reason?: string) => void };
}

function DeckOverlay({
  layers,
  onHover,
  onClick,
  getTooltip,
  onAfterRender,
  handleRef,
}: {
  layers: Layer[];
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;
  getTooltip?: UnifiedMapProps["getTooltip"];
  onAfterRender?: () => void;
  handleRef: React.MutableRefObject<DeckOverlayHandle | null>;
}) {
  // interleaved:false = overlaid mode (deck canvas on top, no depth interaction),
  // matching today's visual behavior.
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved: false, layers })
  );
  overlay.setProps({
    layers,
    onHover,
    onClick,
    getTooltip,
    // Only forward onAfterRender when defined: deck's Deck class calls it
    // unconditionally, so an explicit undefined overrides the noop default
    // and throws (see UnifiedMap.test.tsx regression).
    ...(onAfterRender ? { onAfterRender } : {}),
  });
  useImperativeHandle(
    handleRef,
    () => ({
      get deck() {
        // MapboxOverlay exposes the underlying Deck as `_deck`; expose it
        // lazily via a getter so the snapshot/export consumers read the
        // live canvas at read time (mirrors the old @deck.gl/react handle).
        return (overlay as unknown as { _deck?: DeckOverlayHandle["deck"] })
          ._deck;
      },
    }),
    [overlay]
  );
  return null;
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
    interactive = true,
    onTransitionEnd,
    hideBasemapPicker = false,
    mapRef,
    enableSnapshot,
    onAfterRender,
    terrain,
    globe,
    buildings,
    allowTerrain,
  },
  ref
) {
  const localMapRef = useRef<MapRef | null>(null);
  const overlayHandleRef = useRef<DeckOverlayHandle | null>(null);
  const programmaticRef = useRef(false);

  useImperativeHandle(ref, () => ({
    get deck() {
      return overlayHandleRef.current?.deck;
    },
  }));

  const setMapRef = useCallback(
    (instance: MapRef | null) => {
      localMapRef.current = instance;
      if (typeof mapRef === "function") mapRef(instance);
      else if (mapRef) {
        (mapRef as React.MutableRefObject<MapRef | null>).current = instance;
      }
    },
    [mapRef]
  );

  // Drive the camera imperatively: flyTo for transitions, jumpTo otherwise.
  useEffect(() => {
    const map = localMapRef.current?.getMap();
    if (!map) return;
    const { method, options } = resolveCameraCommand(
      camera,
      transitionDuration
    );
    programmaticRef.current = true;
    map[method](options);
    if (method === "jumpTo") programmaticRef.current = false;
  }, [camera, transitionDuration]);

  // Apply 3D scene props (terrain/globe/buildings) via native MapLibre APIs.
  // setStyle (basemap switch) wipes these, so re-apply on every styledata.
  useEffect(() => {
    const map = localMapRef.current?.getMap();
    if (!map) return;
    const opts = {
      terrain,
      globe,
      buildings,
      allowTerrain: allowTerrain ?? true,
    };
    const run = () => apply3D(map as never, opts);
    if (map.isStyleLoaded()) run();
    else map.once("style.load", run);
    const unbind = bindStyleReapply(map as never, () => opts);
    return unbind;
  }, [terrain, globe, buildings, allowTerrain]);

  const handleMove = useCallback(
    (e: {
      viewState: {
        longitude: number;
        latitude: number;
        zoom: number;
        bearing: number;
        pitch: number;
      };
    }) => {
      if (programmaticRef.current) return;
      const vs = e.viewState;
      onCameraChange({
        longitude: vs.longitude,
        latitude: vs.latitude,
        zoom: vs.zoom,
        bearing: vs.bearing ?? 0,
        pitch: vs.pitch ?? 0,
      });
    },
    [onCameraChange]
  );

  const handleMoveEnd = useCallback(() => {
    programmaticRef.current = false;
    onTransitionEnd?.();
  }, [onTransitionEnd]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        ref={setMapRef}
        mapStyle={BASEMAPS[basemap]}
        initialViewState={{
          longitude: camera.longitude,
          latitude: camera.latitude,
          zoom: camera.zoom,
          bearing: camera.bearing,
          pitch: camera.pitch,
        }}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        interactive={interactive}
        // @ts-expect-error preserveDrawingBuffer forwarded to maplibre-gl
        preserveDrawingBuffer={enableSnapshot ?? false}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay
          layers={layers}
          onHover={onHover}
          onClick={onClick}
          getTooltip={getTooltip}
          onAfterRender={onAfterRender}
          handleRef={overlayHandleRef}
        />
      </Map>

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
    </div>
  );
});
