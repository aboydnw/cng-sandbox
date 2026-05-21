import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["iife"],
      name: "CngArchive",
      fileName: () => "bundle.js",
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "bundle.css" : "[name][extname]",
      },
    },
    target: "es2022",
    minify: "esbuild",
    sourcemap: true,
  },
});
