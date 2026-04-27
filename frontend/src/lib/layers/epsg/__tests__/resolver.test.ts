import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EpsgResolver } from "@developmentseed/proj";
import { createCngEpsgResolver } from "../resolver";

describe("cngEpsgResolver", () => {
  let networkResolver: ReturnType<typeof vi.fn> & EpsgResolver;

  beforeEach(() => {
    networkResolver = vi.fn() as ReturnType<typeof vi.fn> & EpsgResolver;
  });

  it("resolves a curated code (5070) without invoking the network resolver", async () => {
    const resolver = createCngEpsgResolver(networkResolver);
    const def = await resolver(5070);
    expect(def).toBeDefined();
    expect(networkResolver).not.toHaveBeenCalled();
  });

  it("resolves a UTM zone (32614) without invoking the network resolver", async () => {
    const resolver = createCngEpsgResolver(networkResolver);
    const def = await resolver(32614);
    expect(def).toBeDefined();
    expect(networkResolver).not.toHaveBeenCalled();
  });

  it("delegates an unknown code to the network resolver", async () => {
    const stubDef = { projName: "stub" } as never;
    networkResolver.mockResolvedValue(stubDef);
    const resolver = createCngEpsgResolver(networkResolver);
    const def = await resolver(99999);
    expect(def).toBe(stubDef);
    expect(networkResolver).toHaveBeenCalledTimes(1);
    expect(networkResolver).toHaveBeenCalledWith(99999);
  });

  it("caches network-resolved codes (one call regardless of repeats)", async () => {
    const stubDef = { projName: "stub" } as never;
    networkResolver.mockResolvedValue(stubDef);
    const resolver = createCngEpsgResolver(networkResolver);
    await resolver(99999);
    await resolver(99999);
    await resolver(99999);
    expect(networkResolver).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight promise across concurrent calls for the same code", async () => {
    let resolveStub: (value: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => {
      resolveStub = resolve;
    });
    networkResolver.mockReturnValue(inFlight);
    const resolver = createCngEpsgResolver(networkResolver);

    const p1 = resolver(99999);
    const p2 = resolver(99999);
    expect(networkResolver).toHaveBeenCalledTimes(1);

    resolveStub({ projName: "stub" });
    const [d1, d2] = await Promise.all([p1, p2]);
    expect(d1).toBe(d2);
  });

  it("does not cache failures (network-resolver retries after rejection)", async () => {
    networkResolver.mockRejectedValueOnce(new Error("boom"));
    networkResolver.mockResolvedValueOnce({ projName: "stub" } as never);
    const resolver = createCngEpsgResolver(networkResolver);
    await expect(resolver(99999)).rejects.toThrow("boom");
    const def = await resolver(99999);
    expect(def).toBeDefined();
    expect(networkResolver).toHaveBeenCalledTimes(2);
  });
});
