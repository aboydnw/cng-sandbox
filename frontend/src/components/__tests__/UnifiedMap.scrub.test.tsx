import { describe, it, expect, vi, beforeEach } from "vitest";
import { forwardRef, useEffect } from "react";
import { render } from "@testing-library/react";

const fakeMap = {
  jumpTo: vi.fn(),
  flyTo: vi.fn(),
  isStyleLoaded: () => true,
  once: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  getTerrain: vi.fn(() => null),
  setTerrain: vi.fn(),
  setSky: vi.fn(),
  getProjection: vi.fn(() => ({ type: "mercator" })),
  setProjection: vi.fn(),
  getSource: vi.fn(),
  addSource: vi.fn(),
  removeSource: vi.fn(),
  getLayer: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
};
let latestMapProps: {
  onMove?: (event: { viewState: typeof cameraA }) => void;
} = {};

vi.mock("react-map-gl/maplibre", () => ({
  Map: forwardRef(function MockMap(
    props: {
      children?: React.ReactNode;
      onMove?: (event: { viewState: typeof cameraA }) => void;
    },
    ref: React.Ref<unknown>
  ) {
    latestMapProps = props;
    useEffect(() => {
      const instance = { getMap: () => fakeMap };
      if (typeof ref === "function") ref(instance);
    }, [ref]);
    return <div data-testid="mock-map">{props.children}</div>;
  }),
  useControl: () => ({ setProps: vi.fn() }),
  useMap: () => ({ current: null }),
}));

vi.mock("../../hooks/useCopcLayer", () => ({ useCopcLayer: () => {} }));

import { UnifiedMap } from "../UnifiedMap";

const cameraA = { longitude: 0, latitude: 0, zoom: 2, bearing: 0, pitch: 0 };
const cameraB = {
  longitude: 10,
  latitude: 10,
  zoom: 5,
  bearing: 45,
  pitch: 30,
};

function renderMap(props: Partial<React.ComponentProps<typeof UnifiedMap>>) {
  return render(
    <UnifiedMap
      camera={cameraA}
      onCameraChange={vi.fn()}
      layers={[]}
      basemap="streets"
      onBasemapChange={vi.fn()}
      interactive={false}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedMap camera-echo guard", () => {
  it("does not replay a user camera update back through jumpTo", () => {
    const onCameraChange = vi.fn();
    const { rerender } = renderMap({ onCameraChange });
    fakeMap.jumpTo.mockClear();

    latestMapProps.onMove?.({ viewState: cameraB });
    expect(onCameraChange).toHaveBeenCalledWith(cameraB);
    rerender(
      <UnifiedMap
        camera={cameraB}
        onCameraChange={onCameraChange}
        layers={[]}
        basemap="streets"
        onBasemapChange={vi.fn()}
        interactive={false}
      />
    );

    expect(fakeMap.jumpTo).not.toHaveBeenCalled();
  });

  it("echoes camera prop changes via jumpTo when not scrubbing", () => {
    const { rerender } = renderMap({});
    fakeMap.jumpTo.mockClear();
    rerender(
      <UnifiedMap
        camera={cameraB}
        onCameraChange={vi.fn()}
        layers={[]}
        basemap="streets"
        onBasemapChange={vi.fn()}
        interactive={false}
      />
    );
    expect(fakeMap.jumpTo).toHaveBeenCalledTimes(1);
  });

  it("suppresses the echo entirely while scrubbing", () => {
    const { rerender } = renderMap({ scrubbing: true });
    fakeMap.jumpTo.mockClear();
    fakeMap.flyTo.mockClear();
    rerender(
      <UnifiedMap
        camera={cameraB}
        onCameraChange={vi.fn()}
        layers={[]}
        basemap="streets"
        onBasemapChange={vi.fn()}
        interactive={false}
        scrubbing
      />
    );
    expect(fakeMap.jumpTo).not.toHaveBeenCalled();
    expect(fakeMap.flyTo).not.toHaveBeenCalled();
  });
});
