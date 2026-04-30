import { defineConfig, mergeConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve, join } from "node:path";
import { writeFileSync } from "node:fs";
import { sharedConfig } from "./vite.shared.config";

function emitFileManifest(): Plugin {
  return {
    name: "viewer-file-manifest",
    apply: "build",
    writeBundle(_options, bundle) {
      const files = Object.keys(bundle).sort();
      writeFileSync(
        join(__dirname, "public/viewer/manifest.json"),
        JSON.stringify({ files }, null, 2)
      );
    },
  };
}

export default defineConfig(
  mergeConfig(sharedConfig, {
    plugins: [react(), viteSingleFile(), emitFileManifest()],
    // Disable static-file copying so fonts/thumbnails/logo from public/ don't
    // get duplicated into public/viewer/.
    publicDir: false,
    build: {
      rollupOptions: {
        input: resolve(__dirname, "viewer.html"),
      },
      // Output to a dedicated subdirectory so sidecar files (web worker chunks
      // emitted by geotiff's decoder pool) don't pollute frontend/public/ root.
      // Task 2 zips the entire public/viewer/ directory.
      outDir: "public/viewer",
      emptyOutDir: true,
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      target: "esnext",
    },
  })
);
