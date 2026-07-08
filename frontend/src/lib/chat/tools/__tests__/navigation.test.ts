import { describe, it, expect, vi } from "vitest";
import { navigationTools } from "../navigation";
import type { AgentBridge } from "../../types";

const byName = (n: string) => navigationTools.find((t) => t.name === n)!;

describe("navigation tools", () => {
  it("fly_to drives the bridge and summarizes", async () => {
    const bridge = { flyTo: vi.fn() } as unknown as AgentBridge;
    const t = byName("fly_to");
    const input = t.schema.parse({
      longitude: -118.5,
      latitude: 34.2,
      zoom: 8,
    });
    const res = await t.execute(input, bridge);
    expect(bridge.flyTo).toHaveBeenCalledWith(
      -118.5,
      34.2,
      8,
      undefined,
      undefined
    );
    expect(res.summary).toContain("34.2");
  });

  it("go_to_chapter rejects a non-integer index", () => {
    expect(() =>
      byName("go_to_chapter").schema.parse({ chapter_index: "two" })
    ).toThrow();
  });

  it("set_layer_visibility toggles via the bridge", async () => {
    const bridge = {
      setLayerVisibility: vi.fn(),
      getChapters: () => [],
    } as unknown as AgentBridge;
    const t = byName("set_layer_visibility");
    await t.execute(t.schema.parse({ layer_id: "L1", visible: false }), bridge);
    expect(bridge.setLayerVisibility).toHaveBeenCalledWith("L1", false);
  });

  it("highlight_location pins via the bridge", async () => {
    const bridge = { highlightLocation: vi.fn() } as unknown as AgentBridge;
    const t = byName("highlight_location");
    const input = t.schema.parse({
      longitude: -118.5,
      latitude: 34.2,
      label: "Landmark",
    });
    const res = await t.execute(input, bridge);
    expect(bridge.highlightLocation).toHaveBeenCalledWith(
      -118.5,
      34.2,
      "Landmark"
    );
    expect(res.summary).toContain("Landmark");
  });

  it("go_to_chapter reports an error for an out-of-range index", async () => {
    const bridge = {
      goToChapter: vi.fn(),
      getChapters: () => [{ index: 0, title: "Intro" }],
    } as unknown as AgentBridge;
    const t = byName("go_to_chapter");
    const res = await t.execute(t.schema.parse({ chapter_index: 9 }), bridge);
    expect(bridge.goToChapter).not.toHaveBeenCalled();
    expect(res.isError).toBe(true);
  });
});
