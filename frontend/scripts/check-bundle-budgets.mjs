import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "dist/.vite/manifest.json");
const baselinePath = resolve(root, "bundle-budgets.json");
const updateBaseline = process.argv.includes("--update-baseline");

if (!existsSync(manifestPath)) {
  throw new Error(
    "Bundle manifest not found. Run the production Vite build before checking budgets."
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const targets = {
  bootstrap: "index.html",
  workspace: "src/pages/WorkspaceHomePage.tsx",
  storyReader: "src/pages/StoryReaderPage.tsx",
  storyEditor: "src/pages/StoryEditorPage.tsx",
  mapViewer: "src/pages/MapPage.tsx",
  storyMapRuntime: "src/components/StoryMapRuntime.tsx",
};

function collectFiles(entryKey) {
  const visitedEntries = new Set();
  const files = new Set();

  function visit(key) {
    if (visitedEntries.has(key)) return;
    visitedEntries.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error("Manifest entry not found: " + key);
    if (entry.file) files.add(entry.file);
    for (const cssFile of entry.css ?? []) files.add(cssFile);
    for (const importedKey of entry.imports ?? []) visit(importedKey);
  }

  visit(entryKey);
  return files;
}

function measureFiles(files) {
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const path = resolve(root, "dist", file);
    const bytes = readFileSync(path);
    rawBytes += statSync(path).size;
    gzipBytes += gzipSync(bytes).length;
  }
  return { rawBytes, gzipBytes };
}

const measurements = Object.fromEntries(
  Object.entries(targets).map(([name, entryKey]) => [
    name,
    {
      entry: entryKey,
      ...measureFiles(collectFiles(entryKey)),
    },
  ])
);

const largestJavaScript = Object.values(manifest)
  .filter((entry) => entry.file?.endsWith(".js"))
  .map((entry) => ({
    entry: entry.file,
    ...measureFiles(new Set([entry.file])),
  }))
  .sort((a, b) => b.rawBytes - a.rawBytes)[0];

measurements.largestSynchronousAsset = largestJavaScript;

if (updateBaseline) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        tolerancePercent: 5,
        baselines: measurements,
      },
      null,
      2
    ) + "\n"
  );
  console.log("Updated " + baselinePath);
}

if (!existsSync(baselinePath)) {
  throw new Error(
    "Bundle baseline not found. Run yarn bundle:baseline intentionally and commit the result."
  );
}

const config = JSON.parse(readFileSync(baselinePath, "utf8"));
const tolerance = config.tolerancePercent / 100;
const failures = [];

console.log("\nFrontend bundle budgets (synchronous dependency closure)");
console.log("Entry                         Raw         Gzip       Baseline");
console.log("----------------------------------------------------------------");

for (const [name, measurement] of Object.entries(measurements)) {
  const baseline = config.baselines[name];
  if (!baseline) {
    failures.push(name + ": no committed baseline");
    continue;
  }

  const rawLimit = Math.ceil(baseline.rawBytes * (1 + tolerance));
  const gzipLimit = Math.ceil(baseline.gzipBytes * (1 + tolerance));
  const passed =
    measurement.rawBytes <= rawLimit && measurement.gzipBytes <= gzipLimit;
  const kb = (value) => (value / 1024).toFixed(1) + " kB";
  console.log(
    name.padEnd(28) +
      " " +
      kb(measurement.rawBytes).padStart(9) +
      " " +
      kb(measurement.gzipBytes).padStart(11) +
      " " +
      (passed ? "ok" : "OVER")
  );

  if (!passed) {
    failures.push(
      name +
        ": " +
        measurement.rawBytes +
        " raw / " +
        measurement.gzipBytes +
        " gzip exceeds " +
        rawLimit +
        " raw / " +
        gzipLimit +
        " gzip"
    );
  }
}

if (failures.length > 0) {
  console.error("\nBundle budget failures:");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
}
