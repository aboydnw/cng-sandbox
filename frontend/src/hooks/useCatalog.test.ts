import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalog } from "./useCatalog";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCatalog", () => {
  it("starts with empty state", () => {
    const { result } = renderHook(() => useCatalog());
    expect(result.current.providers).toEqual([]);
    expect(result.current.selectedCollection).toBeNull();
    expect(result.current.results).toEqual([]);
  });

  it("fetches providers on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "earth-search", name: "Earth Search", description: "..." }],
    });

    const { result } = renderHook(() => useCatalog());
    await act(async () => {});

    expect(result.current.providers).toHaveLength(1);
    expect(result.current.providers[0].id).toBe("earth-search");
  });

  it("fetches collections when provider is selected", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "earth-search", name: "Earth Search", description: "..." }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collections: [{ id: "sentinel-2-l2a", title: "Sentinel-2", description: "..." }],
        }),
      });

    const { result } = renderHook(() => useCatalog());
    await act(async () => {});
    await act(async () => {
      result.current.selectProvider("earth-search");
    });

    expect(result.current.collections).toHaveLength(1);
  });
});
