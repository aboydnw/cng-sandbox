import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataTools } from "../data";
import type { AgentBridge } from "../../types";

const byName = (n: string) => dataTools.find((t) => t.name === n)!;

beforeEach(() => vi.restoreAllMocks());

describe("data tools", () => {
  it("query_point reads titiler /cog/point for each visible raster layer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ values: [27.4] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridge = {
      getActiveLayers: () => [
        {
          layer_id: "L1",
          type: "raster-cog",
          cogUrl: "https://x/y.tif",
          label: "SST",
        },
      ],
    } as unknown as AgentBridge;
    const t = byName("query_point");
    const res = await t.execute(
      t.schema.parse({ longitude: -118.5, latitude: 34.2 }),
      bridge
    );
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/cog/point/-118.5,34.2");
    expect(calledUrl).toContain(encodeURIComponent("https://x/y.tif"));
    expect(res.summary).toContain("27.4");
  });

  it("get_area_statistics POSTs a GeoJSON polygon and reads feature-keyed stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "Feature",
        properties: {
          statistics: { b1: { min: 1, max: 9, mean: 4.5 } },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridge = {
      getActiveLayers: () => [
        {
          layer_id: "L1",
          type: "raster-cog",
          cogUrl: "https://x/y.tif",
          label: "SST",
        },
      ],
    } as unknown as AgentBridge;
    const t = byName("get_area_statistics");
    const res = await t.execute(
      t.schema.parse({ bbox: [-10, -5, 10, 5] }),
      bridge
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/statistics?url=");
    expect(url).not.toContain("bbox=");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.geometry.type).toBe("Polygon");
    expect(body.geometry.coordinates[0]).toEqual([
      [-10, -5],
      [10, -5],
      [10, 5],
      [-10, 5],
      [-10, -5],
    ]);
    expect(res.summary).toContain("min 1");
    expect(res.summary).toContain("max 9");
    expect(res.summary).toContain("mean 4.50");
  });

  it("query_features returns a count and small sample, not raw features", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numberMatched: 142,
        features: Array.from({ length: 5 }, (_, i) => ({
          properties: { name: `F${i}` },
        })),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridge = {
      getActiveLayers: () => [
        { layer_id: "V1", type: "vector-geoparquet", collectionId: "coll_1" },
      ],
    } as unknown as AgentBridge;
    const res = await byName("query_features").execute(
      byName("query_features").schema.parse({ cql2_filter: "pop > 1000" }),
      bridge
    );
    expect(res.summary).toContain("142");
    expect(res.summary.length).toBeLessThan(300);
  });
});
