export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API, raster, and vector requests pass through to the tunnel origin
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/raster/") ||
      url.pathname.startsWith("/vector/")
    ) {
      return fetch(request);
    }

    // Storage requests served from R2 bucket
    if (url.pathname.startsWith("/storage/")) {
      const key = url.pathname.slice("/storage/".length);

      // HEAD requests — return metadata without fetching body
      if (request.method === "HEAD") {
        const head = await env.BUCKET.head(key);
        if (!head) return new Response(null, { status: 404 });
        const headers = new Headers();
        head.writeHttpMetadata(headers);
        headers.set("etag", head.httpEtag);
        headers.set("accept-ranges", "bytes");
        headers.set("content-length", String(head.size));
        return new Response(null, { headers });
      }

      const object = await env.BUCKET.get(key, { range: request.headers });

      if (!object) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("accept-ranges", "bytes");

      // Support HTTP range requests (needed for PMTiles and COG clients)
      if (object.range) {
        headers.set(
          "content-range",
          `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`
        );
        return new Response(object.body, { status: 206, headers });
      }

      return new Response(object.body, { headers });
    }

    // Everything else goes to Pages
    const pagesUrl = new URL(url.pathname + url.search, env.PAGES_URL);
    const pagesResponse = await fetch(pagesUrl, {
      headers: request.headers,
      method: request.method,
    });

    return pagesResponse;
  },
};
