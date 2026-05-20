import "./styles.css";
import type { Manifest } from "./types";
import { renderChapter } from "./render";

async function loadManifest(basePath: string): Promise<Manifest> {
  const resp = await fetch(`${basePath}/manifest.json`);
  if (!resp.ok) throw new Error(`manifest.json fetch failed: ${resp.status}`);
  return (await resp.json()) as Manifest;
}

function renderHeader(manifest: Manifest, host: HTMLElement): void {
  const header = document.createElement("header");
  const h1 = document.createElement("h1");
  h1.textContent = manifest.story.title || "(untitled)";
  header.appendChild(h1);
  if (manifest.story.description) {
    const p = document.createElement("p");
    p.className = "description";
    p.textContent = manifest.story.description;
    header.appendChild(p);
  }
  host.appendChild(header);
}

function renderFooter(manifest: Manifest, host: HTMLElement): void {
  const footer = document.createElement("footer");
  footer.textContent = `Exported ${manifest.exported_at} · runtime ${manifest.runtime_version}`;
  host.appendChild(footer);
}

async function bootstrap(): Promise<void> {
  const article = document.querySelector<HTMLElement>("article#story");
  if (!article) throw new Error("expected <article id='story'> in shell HTML");
  const basePath = document.documentElement.dataset.basePath ?? ".";

  const manifest = await loadManifest(basePath);
  renderHeader(manifest, article);

  for (const chapter of manifest.chapters) {
    await renderChapter(chapter, article, basePath);
  }
  renderFooter(manifest, article);
}

bootstrap().catch((err) => {
  const article = document.querySelector("article#story");
  if (article) {
    article.replaceChildren();
    const p = document.createElement("p");
    p.style.color = "#a00";
    p.textContent = `Failed to load story: ${
      err instanceof Error ? err.message : String(err)
    }`;
    article.appendChild(p);
  }
  // eslint-disable-next-line no-console
  console.error(err);
});

if (typeof window !== "undefined") {
  (
    window as unknown as { CngArchive: { renderChapter: typeof renderChapter } }
  ).CngArchive = {
    renderChapter,
  };
}
