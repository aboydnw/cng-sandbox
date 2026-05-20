import { marked } from "marked";
import DOMPurify from "dompurify";

export function renderNarrative(narrative: string | undefined | null): string {
  if (!narrative) return "";
  const html = marked.parse(narrative, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

export function setNarrativeHtml(
  host: HTMLElement,
  narrative: string | undefined | null
): void {
  host.innerHTML = renderNarrative(narrative);
}
