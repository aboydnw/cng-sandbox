import * as zarr from "zarrita";

type OriginDecision = "direct" | "proxy";

const originDecisions = new Map<string, OriginDecision>();

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function buildProxyRequest(originalRequest: Request): Request {
  // Absolute URL because jsdom/undici reject relative URLs in `new Request()`.
  // In a real browser, location.origin equals the page origin so this resolves
  // identically to a relative `/api/zarr-proxy?url=...`.
  const base =
    typeof globalThis.location !== "undefined"
      ? globalThis.location.origin
      : "http://localhost";
  const proxyUrl = `${base}/api/zarr-proxy?url=${encodeURIComponent(originalRequest.url)}`;
  return new Request(proxyUrl, originalRequest);
}

/**
 * Builds a zarrita {@link zarr.FetchStore} that transparently falls back to
 * the cng-sandbox `/api/zarr-proxy` endpoint when a direct browser fetch hits
 * a CORS error. The fallback decision is cached per-origin in module state so
 * that subsequent chunk fetches against the same store skip the probe.
 *
 * Use this everywhere the frontend needs to read a remote zarr — never construct
 * a raw `zarr.FetchStore` directly.
 */
export function createZarrStore(url: string): zarr.FetchStore {
  const origin = originOf(url);

  return new zarr.FetchStore(url, {
    fetch: async (request: Request): Promise<Response> => {
      const cached = originDecisions.get(origin);
      if (cached === "proxy") {
        return fetch(buildProxyRequest(request));
      }

      try {
        const response = await fetch(request);
        if (cached === undefined) originDecisions.set(origin, "direct");
        return response;
      } catch (err) {
        if (err instanceof TypeError) {
          originDecisions.set(origin, "proxy");
          return fetch(buildProxyRequest(request));
        }
        throw err;
      }
    },
  });
}

/** Test helper. Do not call from production code. */
export function _resetOriginCacheForTests(): void {
  originDecisions.clear();
}
