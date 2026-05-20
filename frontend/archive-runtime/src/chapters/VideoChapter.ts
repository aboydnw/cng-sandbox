import type { VideoChapterEntry } from "../types";
import { setNarrativeHtml } from "../lib/narrative";

function thumbnailUrl(video: VideoChapterEntry["video"]): string | null {
  if (video.provider === "youtube" && video.video_id) {
    return `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
  }
  return null;
}

function safeHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:")
      return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function renderVideoChapter(
  chapter: VideoChapterEntry,
  host: HTMLElement
): void {
  const section = document.createElement("section");
  section.className = "chapter video";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }
  const thumb = thumbnailUrl(chapter.video);
  if (thumb) {
    const img = document.createElement("img");
    img.src = thumb;
    img.alt = chapter.title || "Video thumbnail";
    section.appendChild(img);
  }
  const safeOriginal = safeHttpUrl(chapter.video.original_url);
  if (safeOriginal) {
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.href = safeOriginal;
    a.textContent = safeOriginal;
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    p.appendChild(document.createTextNode("Original video: "));
    p.appendChild(a);
    section.appendChild(p);
  }
  if (chapter.narrative) {
    const body = document.createElement("div");
    body.className = "chapter-body";
    setNarrativeHtml(body, chapter.narrative);
    section.appendChild(body);
  }
  host.appendChild(section);
}
