import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Layer } from "@deck.gl/core";
import { useAtomicStoryScene, type StoryScene } from "../useAtomicStoryScene";

interface FakeLayer extends Layer {
  ready: boolean;
}

interface CloneTracker {
  count: number;
}

function fakeLayer(
  id: string,
  ready = false,
  opacity = 1,
  tracker: CloneTracker = { count: 0 }
): FakeLayer {
  const layer = {
    id,
    ready,
    props: { opacity },
    get isLoaded() {
      return this.ready;
    },
    clone(next: { id: string; opacity: number }) {
      tracker.count += 1;
      return fakeLayer(next.id, this.ready, next.opacity, tracker);
    },
  };
  return layer as unknown as FakeLayer;
}

function scene(
  key: string,
  layer: FakeLayer | FakeLayer[]
): StoryScene<{ chapter: string }> {
  return {
    key,
    layers: Array.isArray(layer) ? layer : [layer],
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

  it("reuses unchanged prepared layers during same-scene animation updates", () => {
    const tripsTracker = { count: 0 };
    const overlayTracker = { count: 0 };
    const trips = fakeLayer("trips", true, 1, tripsTracker);
    const overlay = fakeLayer("overlay", true, 1, overlayTracker);
    const { rerender } = renderHook(({ value }) => useAtomicStoryScene(value), {
      initialProps: { value: scene("A", [trips, overlay]) },
    });

    expect(tripsTracker.count).toBe(1);
    expect(overlayTracker.count).toBe(1);

    const nextTripsFrame = fakeLayer("trips", true, 1, tripsTracker);
    rerender({ value: scene("A", [nextTripsFrame, overlay]) });

    expect(tripsTracker.count).toBe(2);
    expect(overlayTracker.count).toBe(1);
  });
});
