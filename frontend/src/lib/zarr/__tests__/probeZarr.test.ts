import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  probeZarr,
  ZARR_NOT_CONSOLIDATED,
  probeZarrSingleArray,
} from "../probeZarr";
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
    const fiveD = JSON.parse(JSON.stringify(V3_CONSOLIDATED));
    fiveD.consolidated_metadata.metadata.temperature_2m.shape = [
      10, 5, 3, 360, 720,
    ];
    fiveD.consolidated_metadata.metadata.temperature_2m.dimension_names = [
      "time",
      "level",
      "ensemble",
      "latitude",
      "longitude",
    ];
    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/zarr.json"))
        return mockZarrJsonResponse(fiveD);
      return new Response(null, { status: 404 });
    });

    const result = await probeZarr("https://example.com/store.zarr");
    const tempVar = result.variables.find((v) => v.name === "temperature_2m");
    expect(tempVar?.compatibility.kind).toBe("incompatible");
    if (tempVar?.compatibility.kind === "incompatible") {
      expect(tempVar.compatibility.reason).toMatch(/5 dimensions/i);
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

  it("decimates time coords longer than MAX_TIME_STEPS_DECODED", async () => {
    const TOTAL = 12000;
    const consolidated = {
      zarr_format: 3,
      node_type: "group",
      attributes: {},
      consolidated_metadata: {
        kind: "inline",
        must_understand: false,
        metadata: {
          "": { zarr_format: 3, node_type: "group", attributes: {} },
          rain: {
            zarr_format: 3,
            node_type: "array",
            attributes: { valid_min: 0, valid_max: 100 },
            shape: [TOTAL, 10, 10],
            data_type: "float32",
            dimension_names: ["time", "lat", "lon"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [1, 10, 10] },
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
            attributes: { units: "hours since 2020-01-01T00:00:00Z" },
            shape: [TOTAL],
            data_type: "int64",
            dimension_names: ["time"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [TOTAL] },
            },
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
    const timeBuf = new BigInt64Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) timeBuf[i] = BigInt(i);

    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/zarr.json"))
        return mockZarrJsonResponse(consolidated);
      if (request.url.endsWith("/time/c/0"))
        return new Response(timeBuf.buffer, { status: 200 });
      return new Response("not found", { status: 404 });
    });

    const result = await probeZarr("https://example.com/store.zarr");
    const rain = result.variables.find((v) => v.name === "rain");
    expect(rain).toBeDefined();
    expect(rain!.timesteps).not.toBeNull();
    expect(rain!.timesteps!.length).toBeLessThanOrEqual(5001);
    expect(rain!.timesteps!.length).toBeGreaterThan(2000);
    expect(rain!.timesteps![0].index).toBe(0);
    expect(rain!.timesteps![rain!.timesteps!.length - 1].index).toBe(TOTAL - 1);
  });

  it("recognizes 4D (time, band, y, x) and decodes band labels", async () => {
    const consolidated = {
      zarr_format: 3,
      node_type: "group",
      attributes: {},
      consolidated_metadata: {
        kind: "inline",
        must_understand: false,
        metadata: {
          "": { zarr_format: 3, node_type: "group", attributes: {} },
          reflectance: {
            zarr_format: 3,
            node_type: "array",
            attributes: { valid_min: 0, valid_max: 1 },
            shape: [4, 3, 100, 100],
            data_type: "float32",
            dimension_names: ["time", "band", "y", "x"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [1, 1, 100, 100] },
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
            attributes: { units: "days since 2024-01-01T00:00:00Z" },
            shape: [4],
            data_type: "int64",
            dimension_names: ["time"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [4] },
            },
            chunk_key_encoding: {
              name: "default",
              configuration: { separator: "/" },
            },
            codecs: [{ name: "bytes", configuration: { endian: "little" } }],
            fill_value: 0,
          },
          band: {
            zarr_format: 3,
            node_type: "array",
            attributes: {},
            shape: [3],
            data_type: "int32",
            dimension_names: ["band"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [3] },
            },
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
    const timeBuf = new BigInt64Array([0n, 1n, 2n, 3n]);
    const bandBuf = new Int32Array([2, 3, 4]);

    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/zarr.json"))
        return mockZarrJsonResponse(consolidated);
      if (request.url.endsWith("/time/c/0"))
        return new Response(timeBuf.buffer, { status: 200 });
      if (request.url.endsWith("/band/c/0"))
        return new Response(bandBuf.buffer, { status: 200 });
      return new Response("not found", { status: 404 });
    });

    const result = await probeZarr("https://example.com/store.zarr");
    const v = result.variables.find((x) => x.name === "reflectance");
    expect(v).toBeDefined();
    expect(v!.compatibility.kind).toBe("ok");
    expect(v!.extraDim).toBe("band");
    expect(v!.extraLabels).toEqual(["2", "3", "4"]);
  });

  it("rejects a 4D variable when the extra dim has > 256 entries", async () => {
    const consolidated = {
      zarr_format: 3,
      node_type: "group",
      attributes: {},
      consolidated_metadata: {
        kind: "inline",
        must_understand: false,
        metadata: {
          "": { zarr_format: 3, node_type: "group", attributes: {} },
          spectra: {
            zarr_format: 3,
            node_type: "array",
            attributes: {},
            shape: [2, 500, 100, 100],
            data_type: "float32",
            dimension_names: ["time", "channel", "y", "x"],
            chunk_grid: {
              name: "regular",
              configuration: { chunk_shape: [1, 1, 100, 100] },
            },
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
    mockFetch.mockImplementation(async (request: Request) =>
      request.url.endsWith("/zarr.json")
        ? mockZarrJsonResponse(consolidated)
        : new Response("not found", { status: 404 })
    );
    const result = await probeZarr("https://example.com/store.zarr");
    const v = result.variables.find((x) => x.name === "spectra");
    expect(v).toBeDefined();
    expect(v!.compatibility.kind).toBe("incompatible");
    if (v!.compatibility.kind === "incompatible") {
      expect(v!.compatibility.reason).toMatch(/500/);
    }
  });
});

describe("probeZarrSingleArray", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetOriginCacheForTests();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("opens a single named array without consolidated metadata", async () => {
    const arrayJson = {
      zarr_format: 3,
      node_type: "array",
      shape: [10, 360, 720],
      data_type: "float32",
      dimension_names: ["time", "latitude", "longitude"],
      attributes: { valid_min: 0, valid_max: 100, units: "mm" },
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
    };
    mockFetch.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/precipitation/zarr.json"))
        return mockZarrJsonResponse(arrayJson);
      if (request.url.endsWith("/zarr.json"))
        return new Response("not found", { status: 404 });
      return new Response("not found", { status: 404 });
    });

    const result = await probeZarrSingleArray(
      "https://example.com/store.zarr",
      "precipitation"
    );

    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe("precipitation");
    expect(result.variables[0].compatibility.kind).toBe("ok");
    expect(result.variables[0].stats).toEqual({ min: 0, max: 100 });
  });

  it("returns incompatible for a 1D array", async () => {
    const arrayJson = {
      zarr_format: 3,
      node_type: "array",
      shape: [10],
      data_type: "float32",
      dimension_names: ["time"],
      attributes: {},
      chunk_grid: { name: "regular", configuration: { chunk_shape: [10] } },
      chunk_key_encoding: {
        name: "default",
        configuration: { separator: "/" },
      },
      codecs: [{ name: "bytes", configuration: { endian: "little" } }],
      fill_value: 0,
    };
    mockFetch.mockImplementation(async (request: Request) =>
      request.url.endsWith("/series/zarr.json")
        ? mockZarrJsonResponse(arrayJson)
        : new Response("not found", { status: 404 })
    );

    const result = await probeZarrSingleArray(
      "https://example.com/store.zarr",
      "series"
    );

    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].compatibility.kind).toBe("incompatible");
  });

  it("throws a clear error when the path does not exist", async () => {
    mockFetch.mockImplementation(
      async () => new Response("not found", { status: 404 })
    );

    await expect(
      probeZarrSingleArray("https://example.com/store.zarr", "missing")
    ).rejects.toThrow(/not found/i);
  });
});
