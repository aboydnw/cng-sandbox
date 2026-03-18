import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
  },
  server: {
    host: true,
    port: 5185,
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:8000",
      "/raster": {
        target: process.env.RASTER_TILER_PROXY_TARGET || "http://localhost:8082",
        rewrite: (path: string) => path.replace(/^\/raster/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-store";
          });
        },
      },
      "/vector": {
        target: process.env.VECTOR_TILER_PROXY_TARGET || "http://localhost:8083",
        rewrite: (path: string) => path.replace(/^\/vector/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Prevent browsers from caching tile responses (including 404s).
            // tipg sets max-age=3600 which causes MapLibre to serve stale 404s
            // for tiles that weren't found during the catalog refresh window.
            proxyRes.headers["cache-control"] = "no-store";
          });
        },
      },
      "/pmtiles": {
        target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/pmtiles/, "/sandbox-data"),
      },
      "/storage": {
        target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/storage/, "/sandbox-data"),
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: [
      "react",
      "react-dom",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/geo-layers",
      "@deck.gl/react",
      "@deck.gl/extensions",
      "@deck.gl/mesh-layers",
      "@deck.gl/widgets",
      "@luma.gl/core",
      "@luma.gl/engine",
      "@luma.gl/webgl",
      "@luma.gl/shadertools",
      "@luma.gl/constants",
      "@luma.gl/gltf",
      "@probe.gl/env",
      "@probe.gl/log",
      "@probe.gl/stats",
    ],
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost",
      },
    },
    globals: true,
    setupFiles: [],
  },
});
