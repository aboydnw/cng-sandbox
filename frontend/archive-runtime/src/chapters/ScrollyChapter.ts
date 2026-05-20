import type { ScrollyChapterEntry } from "../types";

export function renderScrollyChapter(
  chapter: ScrollyChapterEntry,
  host: HTMLElement,
  basePath: string,
): void {
  const section = document.createElement("section");
  section.className = "chapter scrolly";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }
  const img = document.createElement("img");
  img.src = `${basePath}/chapters/${chapter.id}/${chapter.snapshot_src}`;
  img.alt = chapter.title || "Map snapshot";
  section.appendChild(img);

  if (chapter.narrative) {
    const body = document.createElement("div");
    body.className = "chapter-body";
    body.innerHTML = chapter.narrative;
    section.appendChild(body);
  }
  host.appendChild(section);
}
