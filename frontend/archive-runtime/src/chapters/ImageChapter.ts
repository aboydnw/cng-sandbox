import type { ImageChapterEntry } from "../types";

export function renderImageChapter(chapter: ImageChapterEntry, host: HTMLElement): void {
  const section = document.createElement("section");
  section.className = "chapter image";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }
  if (chapter.image_url) {
    const img = document.createElement("img");
    img.src = chapter.image_url;
    img.alt = chapter.alt || "";
    section.appendChild(img);
  }
  if (chapter.narrative) {
    const body = document.createElement("div");
    body.className = "chapter-body";
    body.innerHTML = chapter.narrative;
    section.appendChild(body);
  }
  host.appendChild(section);
}
