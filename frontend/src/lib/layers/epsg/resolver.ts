import { epsgResolver as defaultEpsgResolver } from "@developmentseed/proj";
import type { EpsgResolver, ProjectionDefinition } from "@developmentseed/proj";
import { INLINE_REGISTRY } from "./inlineRegistry";

export function createCngEpsgResolver(
  networkResolver: EpsgResolver = defaultEpsgResolver
): EpsgResolver {
  const cache = new Map<number, Promise<ProjectionDefinition>>();
  return async function cngEpsgResolver(
    epsg: number
  ): Promise<ProjectionDefinition> {
    const cached = cache.get(epsg);
    if (cached) return cached;

    const inline = INLINE_REGISTRY.get(epsg);
    if (inline) {
      const promise = Promise.resolve(inline);
      cache.set(epsg, promise);
      return promise;
    }

    const promise = networkResolver(epsg);
    cache.set(epsg, promise);
    try {
      return await promise;
    } catch (err) {
      // don't cache failures so the caller can retry
      cache.delete(epsg);
      throw err;
    }
  };
}

export const cngEpsgResolver: EpsgResolver = createCngEpsgResolver();
