import { describe, it, expect, beforeEach, vi } from "vitest";
import { probeZarr, ZARR_NOT_CONSOLIDATED } from "../probeZarr";
import { _resetOriginCacheForTests } from "../zarrFetch";

const V3_CONSOLIDATED = {
  zarr_format: 3,
  node_type: "group",
  attributes: {},
  consolidated_metadata: {
    kind: "inline",
    must_understand: false,
    metadata: {
      "": {
        zarr_format: 3,
        node_type: "group",
        attributes: {},
      },
      temperature_2m: {
        zarr_format: 3,
        node_type: "array",
        attributes: {
          valid_min: 200.0,
          valid_max: 320.0,
          standard_name: "air_temperature",
          units: "K",
        },
        shape: [10, 360, 720],
        data_type: "float32",
        dimension_names: ["time", "latitude", "longitude"],
        chunk_grid: {
          name: "regular",
          configuration: { chunk_shape: [1, 360, 720] },
        },
        chunk_key_encoding: {
          name: "default",
          configuration: { separator: "/" },
        },
        codecs: [{ name: "bytes", configuration: { endian: "little" } }],
        fill_value: 0,
      },
      time: {
        zarr_format: 3,
        node_type: "array",
        attributes: {
          standard_name: "time",
          units: "hours since 2024-01-01T00:00:00Z",
          calendar: "proleptic_gregorian",
        },
        shape: [10],
        data_type: "int64",
        dimension_names: ["time"],
        chunk_grid: { name: "regular", configuration: { chunk_shape: [10] } },
        chunk_key_encoding: {
          name: "default",
          configuration: { separator: "/" },
        },
        codecs: [{ name: "bytes", configuration: { endian: "little" } }],
        fill_value: 0,
      },
    },
  },
};

function mockZarrJsonResponse(body: object) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("probeZarr", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetOriginCacheForTests();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("enumerates variables from a v3 consolidated store", async () => {
    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/zarr.json"))
        return mockZarrJsonResponse(V3_CONSOLIDATED);
      return new Response(null, { status: 404 });
    });

    const result = await probeZarr("https://example.com/store.zarr");
    const tempVar = result.variables.find((v) => v.name === "temperature_2m");
    expect(tempVar).toBeDefined();
    expect(tempVar?.shape).toEqual([10, 360, 720]);
    expect(tempVar?.dimNames).toEqual(["time", "latitude", "longitude"]);
    expect(tempVar?.dtype).toBe("float32");
    expect(tempVar?.stats).toEqual({ min: 200, max: 320 });
    expect(tempVar?.timeDim).toBe("time");
    expect(tempVar?.compatibility).toEqual({ kind: "ok" });
  });

  it("flags variables with too many dims as incompatible", async () => {
    const fourD = JSON.parse(JSON.stringify(V3_CONSOLIDATED));
    fourD.consolidated_metadata.metadata.temperature_2m.shape = [
      10, 5, 360, 720,
    ];
    fourD.consolidated_metadata.metadata.temperature_2m.dimension_names = [
      "time",
      "level",
      "latitude",
      "longitude",
    ];
    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/zarr.json"))
        return mockZarrJsonResponse(fourD);
      return new Response(null, { status: 404 });
    });

    const result = await probeZarr("https://example.com/store.zarr");
    const tempVar = result.variables.find((v) => v.name === "temperature_2m");
    expect(tempVar?.compatibility.kind).toBe("incompatible");
    if (tempVar?.compatibility.kind === "incompatible") {
      expect(tempVar.compatibility.reason).toMatch(/extra dimensions/i);
    }
  });

  it("throws ZARR_NOT_CONSOLIDATED when the store has no consolidated metadata", async () => {
    mockFetch.mockImplementation(
      async () => new Response(null, { status: 404 })
    );

    await expect(probeZarr("https://example.com/store.zarr")).rejects.toThrow(
      ZARR_NOT_CONSOLIDATED
    );
  });
});
