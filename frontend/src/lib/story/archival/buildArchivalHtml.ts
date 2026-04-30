import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import type { CngRcChapter, CngRcConfig } from "../cngRcTypes";
import { buildCitationBlock, escapeHtml } from "./citations";
import { captureChapterMap } from "./captureMap";
import { fetchAndInlineAsBase64 } from "./inlineAsset";

/**
 * Assemble a single self-contained archival HTML document from a cng-rc.json
 * config. Dublin Core meta tags, chapter content (prose, map snapshots, video
 * thumbnails, images), and a data-citations block are all inlined — the result
 * has no external dependencies and is safe to archive as a standalone file.
 */
export async function buildArchivalHtml(config: CngRcConfig): Promise<string> {
  const chapterFragments = await Promise.all(
    config.chapters.map((ch) => renderChapter(ch, config)),
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.metadata.title)}</title>
  ${dublinCoreMetaTags(config)}
  <style>${archivalStyles}</style>
</head>
<body>
  <article>
    <header>
      <h1>${escapeHtml(config.metadata.title)}</h1>
      ${config.metadata.description ? `<p class="description">${escapeHtml(config.metadata.description)}</p>` : ""}
      ${config.metadata.author ? `<p class="author">By ${escapeHtml(config.metadata.author)}</p>` : ""}
    </header>
    ${chapterFragments.join("\n")}
  </article>
  ${buildCitationBlock(config)}
  <footer>
    <p>
      Exported from CNG on ${escapeHtml(config.origin.exported_at)}.
      Story ID: <code>${escapeHtml(config.origin.story_id)}</code>.
    </p>
  </footer>
</body>
</html>`;
}

function renderMarkdown(body: string): string {
  return renderToStaticMarkup(createElement(Markdown, null, body));
}

async function renderChapter(ch: CngRcChapter, _config: CngRcConfig): Promise<string> {
  const title = ch.title ? `<h2>${escapeHtml(ch.title)}</h2>` : "";
  const body = ch.body ? `<div class="chapter-body">${renderMarkdown(ch.body)}</div>` : "";

  switch (ch.type) {
    case "prose":
      return `<section class="chapter prose">${title}${body}</section>`;

    case "map": {
      const dataUrl = await captureChapterMap();
      return `<section class="chapter map">${title}<img src="${dataUrl}" alt="Map snapshot" />${body}</section>`;
    }

    case "scrollytelling": {
      const dataUrl = await captureChapterMap();
      return `<section class="chapter scrolly">${title}<img src="${dataUrl}" alt="Map snapshot" />${body}</section>`;
    }

    case "image": {
      const url = ch.extra?.image_url as string | undefined;
      const inlined = url ? await fetchAndInlineAsBase64(url) : "";
      return `<section class="chapter image">${title}${inlined ? `<img src="${inlined}" alt="" />` : ""}${body}</section>`;
    }

    case "video": {
      const thumbnailUrl =
        (ch.extra?.thumbnail_url as string | undefined) ||
        (ch.extra?.poster as string | undefined);
      const inlined = thumbnailUrl ? await fetchAndInlineAsBase64(thumbnailUrl) : "";
      const sourceUrl = ch.extra?.video_url as string | undefined;
      return `<section class="chapter video">
        ${title}
        ${inlined ? `<img src="${inlined}" alt="Video thumbnail" />` : ""}
        ${sourceUrl ? `<p><small>Original video: <a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></small></p>` : ""}
        ${body}
      </section>`;
    }

    case "chart": {
      return `<section class="chapter chart">${title}<p><em>(Chart rendering pending)</em></p>${body}</section>`;
    }

    default: {
      const _exhaustive: never = ch.type;
      void _exhaustive;
      return `<section class="chapter">${title}${body}</section>`;
    }
  }
}

function dublinCoreMetaTags(config: CngRcConfig): string {
  const tags: string[] = [];
  tags.push(`<meta name="dc.title" content="${escapeHtml(config.metadata.title)}">`);
  if (config.metadata.author) {
    tags.push(`<meta name="dc.creator" content="${escapeHtml(config.metadata.author)}">`);
  }
  tags.push(`<meta name="dc.date" content="${escapeHtml(config.metadata.updated)}">`);
  if (config.metadata.description) {
    tags.push(
      `<meta name="dc.description" content="${escapeHtml(config.metadata.description)}">`,
    );
  }
  for (const layer of Object.values(config.layers)) {
    if (layer.source_url) {
      tags.push(`<meta name="dc.source" content="${escapeHtml(layer.source_url)}">`);
    }
  }
  return tags.join("\n  ");
}

const archivalStyles = `
  body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #222; }
  header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .description { color: #555; }
  .author { font-style: italic; color: #777; }
  section.chapter { margin: 3rem 0; }
  section.chapter img { max-width: 100%; height: auto; }
  .citations { border-top: 1px solid #ccc; margin-top: 4rem; padding-top: 1rem; font-size: 0.9rem; }
  .citations ul { list-style: none; padding: 0; }
  .citations li { margin: 0.75rem 0; }
  footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid #eee; color: #888; font-size: 0.85rem; }
`;
