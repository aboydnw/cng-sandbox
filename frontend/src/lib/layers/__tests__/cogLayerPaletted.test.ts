import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@developmentseed/deck.gl-geotiff", () => ({
  COGLayer: vi.fn().mockImplementation((props) => ({ props })),
}));

vi.mock("@developmentseed/deck.gl-raster/gpu-modules", () => ({
  CreateTexture: {},
  Colormap: {},
}));

import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { buildCogLayerPaletted } from "../cogLayer";

describe("buildCogLayerPaletted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs a COGLayer with no custom getTileData/renderTile", () => {
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/test.tif",
      opacity: 0.75,
    });

    expect(layers).toHaveLength(1);
    expect(COGLayer).toHaveBeenCalledTimes(1);
    const props = (COGLayer as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as Record<string, unknown>;

    expect(props.getTileData).toBeUndefined();
    expect(props.renderTile).toBeUndefined();
    expect(props.opacity).toBe(0.75);
    expect(typeof props.geotiff).toBe("string");
    // Must be an absolute URL — MapLibre and deck.gl-geotiff both fail on
    // relative ones when the dev-server proxy is involved.
    expect(props.geotiff).toMatch(/^https?:\/\//);
    expect(props.geotiff as string).toContain("/cog/test.tif");
  });

  it("propagates opacity changes to a stable layer id", () => {
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/test.tif",
      opacity: 0.25,
    });
    const props = (layers[0] as { props: Record<string, unknown> }).props;
    expect(props.id).toBe("direct-cog-layer-paletted");
  });
});

describe("buildCogLayerPaletted with categories", () => {
  it("returns a layer with getTileData defined when categories are supplied", () => {
    const cacheRef = { current: new Map() };
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/example.tif",
      opacity: 1,
      categories: [{ value: 1, color: "#ff0000", label: "A" }],
      tileCacheRef: cacheRef,
    });
    expect(layers).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layerProps = (layers[0] as any).props;
    expect(typeof layerProps.getTileData).toBe("function");
    expect(typeof layerProps.renderTile).toBe("function");
    expect(layerProps.pickable).toBe(true);
  });

  it("returns a layer with the default pipeline when categories are omitted", () => {
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/example.tif",
      opacity: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layerProps = (layers[0] as any).props;
    expect(layerProps.getTileData).toBeUndefined();
    expect(layerProps.renderTile).toBeUndefined();
  });

  it("caches raw tile values when getTileData runs", async () => {
    const cacheRef = { current: new Map() };
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/example.tif",
      opacity: 1,
      categories: [{ value: 1, color: "#ff0000", label: "A" }],
      tileCacheRef: cacheRef,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getTileData = (layers[0] as any).props.getTileData;

    const fakeTile = {
      array: {
        layout: "interleaved",
        bands: [],
        data: new Uint8Array([1, 0, 1, 0]),
        width: 2,
        height: 2,
      },
    };
    const image = {
      fetchTile: vi.fn().mockResolvedValue(fakeTile),
    };
    const device = {
      createTexture: vi.fn().mockReturnValue({ mock: "tex" }),
    };

    await getTileData(image, {
      device,
      x: 3,
      y: 5,
      signal: new AbortController().signal,
    });

    expect(cacheRef.current.size).toBe(1);
    const entry = cacheRef.current.get("3/5");
    expect(entry).toBeDefined();
    expect(entry!.width).toBe(2);
    expect(entry!.height).toBe(2);
    // raw values preserved
    expect(Array.from(entry!.data)).toEqual([1, 0, 1, 0]);
  });
});
