import JSZip from "jszip";
import { slugifyStoryTitle } from "./slug";

interface ViewerManifest {
  files: string[];
}

export async function buildAndDownloadBundle(
  storyId: string,
  storyTitle: string
): Promise<void> {
  const manifest = await fetch("/viewer/manifest.json")
    .then(assertOk)
    .then((r) => r.json() as Promise<ViewerManifest>);

  const fileFetches = manifest.files.map(async (name) => {
    const response = await fetch(`/viewer/${name}`).then(assertOk);
    return [name, await response.arrayBuffer()] as const;
  });
  const configFetch = fetch(`/api/stories/${storyId}/export/config`)
    .then(assertOk)
    .then((r) => r.json());

  const [files, config] = await Promise.all([
    Promise.all(fileFetches),
    configFetch,
  ]);

  const zip = new JSZip();
  for (const [name, content] of files) {
    const zipName = name === "viewer.html" ? "index.html" : name;
    zip.file(zipName, content);
  }
  zip.file("cng-rc.json", JSON.stringify(config, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugifyStoryTitle(storyTitle)}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revocation so Safari's download manager can read the blob first.
  // WebKit bugs #211234 and #236692 break downloads if the URL is revoked
  // synchronously after click().
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function assertOk(r: Response): Promise<Response> {
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r;
}
