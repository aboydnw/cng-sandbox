import type { UserConfig } from "vite";

export const sharedConfig: UserConfig = {
  worker: {
    format: "es",
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
    esbuildOptions: {
      target: "esnext",
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
};
