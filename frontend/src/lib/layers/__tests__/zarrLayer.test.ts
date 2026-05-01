import { describe, expect, it, vi } from "vitest";
import { buildZarrLayer } from "../zarrLayer";
import type { GeoZarrAttrs } from "../../../types";

vi.mock("@developmentseed/deck.gl-zarr", () => ({
  ZarrLayer: class {
    props: unknown;
    constructor(props: unknown) {
      this.props = props;
    }
  },
}));

const fakeNode = { kind: "group" } as unknown as Parameters<
  typeof buildZarrLayer
>[0]["node"];

const baseOpts = {
  node: fakeNode,
  variable: "precipitation",
  selection: { time: 0 },
  opacity: 1,
  rescaleMin: 0,
  rescaleMax: 30,
  colormapName: "blues",
};

describe("buildZarrLayer", () => {
  it("omits the metadata prop when geozarrAttrs is undefined", () => {
    const [layer] = buildZarrLayer(baseOpts);
    // @ts-expect-error - test shim exposes mocked props
    expect(layer.props.metadata).toBeUndefined();
  });

  it("threads geozarrAttrs into the ZarrLayer metadata prop", () => {
    const attrs: GeoZarrAttrs = {
      "spatial:dimensions": ["latitude", "longitude"],
      "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
      "spatial:shape": [1800, 3600],
      "proj:code": "EPSG:4326",
    };
    const [layer] = buildZarrLayer({ ...baseOpts, geozarrAttrs: attrs });
    // @ts-expect-error - test shim exposes mocked props
    expect(layer.props.metadata).toEqual(attrs);
  });
});
