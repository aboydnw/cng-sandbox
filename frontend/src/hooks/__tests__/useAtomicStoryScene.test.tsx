import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Layer } from "@deck.gl/core";
import { useAtomicStoryScene, type StoryScene } from "../useAtomicStoryScene";

interface FakeLayer extends Layer {
  ready: boolean;
}

function fakeLayer(id: string, ready = false, opacity = 1): FakeLayer {
  const layer = {
    id,
    ready,
    props: { opacity },
    get isLoaded() {
      return this.ready;
    },
    clone(next: { id: string; opacity: number }) {
      return fakeLayer(next.id, this.ready, next.opacity);
    },
  };
  return layer as unknown as FakeLayer;
}

function scene(key: string, layer: FakeLayer): StoryScene<{ chapter: string }> {
  return {
    key,
    layers: [layer],
    payload: { chapter: key },
  };
}

describe("useAtomicStoryScene", () => {
  it("keeps the committed scene visible while staging a replacement", () => {
    const layerA = fakeLayer("raster-a", true, 0.8);
    const layerB = fakeLayer("raster-b", false, 0.6);
    const { result, rerender } = renderHook(
      ({ value }) => useAtomicStoryScene(value),
      { initialProps: { value: scene("A", layerA) } }
    );

    rerender({ value: scene("B", layerB) });

    const [visible, pending] = result.current.layers as FakeLayer[];
    expect(result.current.transitioning).toBe(true);
    expect(result.current.payload.chapter).toBe("A");
    expect(visible.id).toContain("story-scene-0");
    expect(visible.props.opacity).toBe(0.8);
    expect(pending.id).toContain("story-scene-1");
    expect(pending.props.opacity).toBe(0);
  });

  it("commits the prepared scene atomically after its layers load", () => {
    const layerA = fakeLayer("raster-a", true);
    const layerB = fakeLayer("vector-b", false, 0.7);
    const { result, rerender } = renderHook(
      ({ value }) => useAtomicStoryScene(value),
      { initialProps: { value: scene("A", layerA) } }
    );

    rerender({ value: scene("B", layerB) });
    (result.current.layers[1] as FakeLayer).ready = true;

    act(() => result.current.onAfterRender());

    expect(result.current.transitioning).toBe(false);
    expect(result.current.payload.chapter).toBe("B");
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toContain("story-scene-1");
    expect(result.current.layers[0].props.opacity).toBe(0.7);
  });

  it("drops a stale pending generation during rapid A to B to C navigation", () => {
    const layerA = fakeLayer("raster-a", true);
    const layerB = fakeLayer("raster-b", false);
    const layerC = fakeLayer("vector-c", false);
    const { result, rerender } = renderHook(
      ({ value }) => useAtomicStoryScene(value),
      { initialProps: { value: scene("A", layerA) } }
    );

    rerender({ value: scene("B", layerB) });
    const staleB = result.current.layers[1] as FakeLayer;
    rerender({ value: scene("C", layerC) });
    staleB.ready = true;
    act(() => result.current.onAfterRender());

    expect(result.current.payload.chapter).toBe("A");
    expect(
      result.current.layers.some((layer) => layer.id.includes("raster-b"))
    ).toBe(false);

    (result.current.layers[1] as FakeLayer).ready = true;
    act(() => result.current.onAfterRender());

    expect(result.current.payload.chapter).toBe("C");
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0].id).toContain("vector-c");
  });
});
