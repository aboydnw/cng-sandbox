import { marked } from "marked";
import type { ProseChapterEntry } from "../types";

export function renderProseChapter(chapter: ProseChapterEntry, host: HTMLElement): void {
  const section = document.createElement("section");
  section.className = "chapter prose";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }
  const body = document.createElement("div");
  body.className = "chapter-body";
  body.innerHTML = chapter.narrative ? (marked.parse(chapter.narrative) as string) : "";
  section.appendChild(body);

  host.appendChild(section);
}
