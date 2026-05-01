import { describe, it, expect, vi } from "vitest";

import { createColormapLutTexture } from "../colormapLutTexture";

describe("createColormapLutTexture", () => {
  function makeDevice() {
    return {
      createTexture: vi.fn().mockReturnValue({ tag: "tex" }),
    };
  }

  it("creates the LUT as a 2d-array rgba8unorm texture sized 256x1x1", () => {
    const device = makeDevice();
    const lut = new Uint8Array(256 * 4);

    createColormapLutTexture(device, lut, "linear");

    expect(device.createTexture).toHaveBeenCalledTimes(1);
    expect(device.createTexture.mock.calls[0][0]).toMatchObject({
      dimension: "2d-array",
      format: "rgba8unorm",
      width: 256,
      height: 1,
      depth: 1,
      mipLevels: 1,
      data: lut,
    });
  });

  it("propagates the requested sampler filter to both min and mag", () => {
    const device = makeDevice();
    const lut = new Uint8Array(256 * 4);

    createColormapLutTexture(device, lut, "nearest");

    const opts = device.createTexture.mock.calls[0][0] as {
      sampler: Record<string, string>;
    };
    expect(opts.sampler.minFilter).toBe("nearest");
    expect(opts.sampler.magFilter).toBe("nearest");
  });

  it("clamps to edge on every axis so out-of-range samples don't wrap", () => {
    const device = makeDevice();
    const lut = new Uint8Array(256 * 4);

    createColormapLutTexture(device, lut, "linear");

    const opts = device.createTexture.mock.calls[0][0] as {
      sampler: Record<string, string>;
    };
    expect(opts.sampler.addressModeU).toBe("clamp-to-edge");
    expect(opts.sampler.addressModeV).toBe("clamp-to-edge");
    expect(opts.sampler.addressModeW).toBe("clamp-to-edge");
  });

  it("returns whatever the device createTexture returns", () => {
    const device = {
      createTexture: vi.fn().mockReturnValue({ tag: "abc" }),
    };
    const result = createColormapLutTexture(
      device,
      new Uint8Array(256 * 4),
      "linear"
    );
    expect(result).toEqual({ tag: "abc" });
  });
});
