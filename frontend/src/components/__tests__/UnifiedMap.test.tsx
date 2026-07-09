import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const overlayProps: Record<string, unknown>[] = [];
const overlayCtorArgs: Record<string, unknown>[] = [];

vi.mock("@deck.gl/mapbox", () => ({
  MapboxOverlay: class {
    _deck = { canvas: document.createElement("canvas") };
    constructor(opts: Record<string, unknown>) {
      overlayCtorArgs.push(opts);
    }
    setProps(props: Record<string, unknown>) {
      overlayProps.push(props);
    }
  },
}));

vi.mock("react-map-gl/maplibre", () => ({
  Map: (props: Record<string, unknown>) => (
    <div data-testid="maplibre-mock">{props.children as React.ReactNode}</div>
  ),
  // useControl runs the factory once and returns the control instance.
  useControl: (factory: () => unknown) => factory(),
  // CopcController calls useMap(); no live map in this render.
  useMap: () => ({ current: null }),
}));

import { UnifiedMap } from "../UnifiedMap";

function wrap(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const camera = { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };

describe("UnifiedMap", () => {
  it("renders a maplibre Map as the root and constructs an overlaid MapboxOverlay", () => {
    overlayCtorArgs.length = 0;
    const { getByTestId } = wrap(
      <UnifiedMap
        camera={camera}
        onCameraChange={() => {}}
        layers={[]}
        basemap="streets"
        onBasemapChange={() => {}}
      />
    );
    expect(getByTestId("maplibre-mock")).toBeTruthy();
    expect(overlayCtorArgs[0].interleaved).toBe(false);
  });

  it("forwards a noop onAfterRender when the prop is omitted (clears stale merged callback)", () => {
    overlayProps.length = 0;
    wrap(
      <UnifiedMap
        camera={camera}
        onCameraChange={() => {}}
        layers={[]}
        basemap="streets"
        onBasemapChange={() => {}}
      />
    );
    // MapboxOverlay.setProps merges into persistent props, so onAfterRender
    // must always be a function — never absent — or a previously-registered
    // callback would linger.
    expect(overlayProps.length).toBeGreaterThan(0);
    expect(
      overlayProps.every((p) => typeof p.onAfterRender === "function")
    ).toBe(true);
  });

  it("forwards onAfterRender to the overlay when provided", () => {
    overlayProps.length = 0;
    const cb = vi.fn();
    wrap(
      <UnifiedMap
        camera={camera}
        onCameraChange={() => {}}
        layers={[]}
        basemap="streets"
        onBasemapChange={() => {}}
        onAfterRender={cb}
      />
    );
    expect(overlayProps.some((p) => p.onAfterRender === cb)).toBe(true);
  });
});
