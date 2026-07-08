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

  it("does not forward onAfterRender to the overlay when the prop is omitted", () => {
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
    expect(overlayProps.some((p) => "onAfterRender" in p)).toBe(false);
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
