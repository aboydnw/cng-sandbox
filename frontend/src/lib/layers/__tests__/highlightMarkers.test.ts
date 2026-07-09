import { describe, it, expect, vi } from "vitest";
import {
  createHighlightElement,
  reconcileHighlightMarkers,
  type Highlight,
  type MarkerHandle,
} from "../highlightMarkers";

const h = (id: string): Highlight => ({
  id,
  longitude: 86.9,
  latitude: 27.9,
  label: `label-${id}`,
});

describe("createHighlightElement", () => {
  it("renders the label text", () => {
    const el = createHighlightElement("Everest");
    expect(el.textContent).toContain("Everest");
  });
});

describe("reconcileHighlightMarkers", () => {
  it("adds a marker for a new highlight", () => {
    const registry = new Map<string, MarkerHandle>();
    const create = vi.fn((hi: Highlight) => ({ remove: vi.fn(), id: hi.id }));
    reconcileHighlightMarkers([h("a")], registry, create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(registry.has("a")).toBe(true);
  });

  it("removes a marker when its highlight disappears", () => {
    const registry = new Map<string, MarkerHandle>();
    const removeA = vi.fn();
    const create = vi.fn(() => ({ remove: removeA }));
    reconcileHighlightMarkers([h("a")], registry, create);
    reconcileHighlightMarkers([], registry, create);
    expect(removeA).toHaveBeenCalledTimes(1);
    expect(registry.has("a")).toBe(false);
  });

  it("does not recreate a marker that already exists", () => {
    const registry = new Map<string, MarkerHandle>();
    const create = vi.fn(() => ({ remove: vi.fn() }));
    reconcileHighlightMarkers([h("a")], registry, create);
    reconcileHighlightMarkers([h("a")], registry, create);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("adds and removes independently in a single reconcile", () => {
    const registry = new Map<string, MarkerHandle>();
    const removeA = vi.fn();
    const create = vi.fn((hi: Highlight) =>
      hi.id === "a" ? { remove: removeA } : { remove: vi.fn() }
    );
    reconcileHighlightMarkers([h("a")], registry, create);
    create.mockClear();
    reconcileHighlightMarkers([h("b")], registry, create);
    expect(removeA).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(registry.has("a")).toBe(false);
    expect(registry.has("b")).toBe(true);
  });
});
