import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const deckPropsCalls: Record<string, unknown>[] = [];

vi.mock("@deck.gl/react", () => ({
  default: (props: Record<string, unknown>) => {
    deckPropsCalls.push(props);
    return (
      <div data-testid="deckgl-mock">{props.children as React.ReactNode}</div>
    );
  },
}));

vi.mock("@deck.gl/core", () => ({
  MapView: class {
    constructor(_opts: unknown) {}
  },
  FlyToInterpolator: class {},
}));

vi.mock("react-map-gl/maplibre", () => ({
  default: () => <div data-testid="maplibre-mock" />,
}));

import { UnifiedMap } from "../UnifiedMap";

function wrap(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const camera = { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 };

describe("UnifiedMap", () => {
  // Regression: deck.gl's Deck class calls `this.props.onAfterRender()`
  // unconditionally during _drawLayers. Passing `onAfterRender={undefined}`
  // overrides its `noop` default and throws
  // `TypeError: this.props.onAfterRender is not a function`,
  // blanking the story reader on any guided-tour chapter.
  it("does not pass onAfterRender to DeckGL when the prop is omitted", () => {
    deckPropsCalls.length = 0;
    wrap(
      <UnifiedMap
        camera={camera}
        onCameraChange={() => {}}
        layers={[]}
        basemap="positron"
        onBasemapChange={() => {}}
      />
    );
    expect(deckPropsCalls).toHaveLength(1);
    expect("onAfterRender" in deckPropsCalls[0]).toBe(false);
  });

  it("forwards onAfterRender when provided", () => {
    deckPropsCalls.length = 0;
    const cb = vi.fn();
    wrap(
      <UnifiedMap
        camera={camera}
        onCameraChange={() => {}}
        layers={[]}
        basemap="positron"
        onBasemapChange={() => {}}
        onAfterRender={cb}
      />
    );
    expect(deckPropsCalls[0].onAfterRender).toBe(cb);
  });
});
