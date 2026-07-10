import { afterEach, describe, expect, it, vi } from "vitest";
import { getExampleState, removeExampleData, seedExampleData } from "../api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("examples api", () => {
  it("seedExampleData posts and returns the story map", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ state: "seeded", story_id_map: { m1: "c1" } }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await seedExampleData("ws1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspaces/ws1/examples",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.story_id_map.m1).toBe("c1");
  });

  it("getExampleState returns state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ state: "removed" }), { status: 200 })
        )
    );
    expect((await getExampleState("ws1")).state).toBe("removed");
  });

  it("removeExampleData rejects on error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 }))
    );
    await expect(removeExampleData("ws1")).rejects.toThrow();
  });
});
