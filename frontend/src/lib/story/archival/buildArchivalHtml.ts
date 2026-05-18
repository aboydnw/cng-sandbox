import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import type { CngRcChapter, CngRcConfig } from "../cngRcTypes";
import type { Chapter, Story } from "../types";
import type { Connection, Dataset } from "../../../types";
import { buildCitationBlock, escapeHtml, safeHttpUrl } from "./citations";
import { captureChapterMap } from "./captureMap";
import { captureChartToDataUrl } from "./captureChart";
import { fetchAndInlineAsBase64 } from "./inlineAsset";

export interface BuildArchivalHtmlArgs {
  config: CngRcConfig;
  story: Story;
  datasetMap: Map<string, Dataset | null>;
  connectionMap: Map<string, Connection>;
}

/**
 * Assemble a single self-contained archival HTML document from a cng-rc.json
 * config plus the live Story + Dataset + Connection rows the live reader uses.
 * Dublin Core meta tags, chapter content (prose, map snapshots, video
 * thumbnails, images), and a data-citations block are all inlined.
 *
 * Map and scrollytelling chapters are rendered offscreen via captureChapterMap
 * and chart chapters via captureChartToDataUrl, using the live datasetMap +
 * connectionMap so map captures route through the same tile endpoints as the
 * in-page reader (e.g. /raster/collections/{id}/... for ingested datasets).
 * Using the cng-rc-synthesized story would force every raster chapter onto
 * the client-side /cog/tiles/?url=… path, which 500s for example datasets
 * whose source_url is a bucket directory listing.
 *
 * Errors from any chapter capture (timeouts, missing canvases, chart load
 * failures) propagate up to the caller; the export fails loudly rather than
 * silently shipping a partial document.
 */
export async function buildArchivalHtml({
  config,
  story,
  datasetMap,
  connectionMap,
}: BuildArchivalHtmlArgs): Promise<string> {
  const chapterFragments = await Promise.all(
    config.chapters.map((rawCh, i) =>
      renderChapter(rawCh, story.chapters[i], datasetMap, connectionMap)
    )
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

async function tryInlineAsset(url: string): Promise<string> {
  try {
    return await fetchAndInlineAsBase64(url);
  } catch (err) {
    console.warn(`Archival export: failed to inline ${url}`, err);
    return "";
  }
}

interface ImageExtra {
  url?: string;
  thumbnail_url?: string;
  alt_text?: string;
}

interface VideoExtra {
  provider?: string;
  video_id?: string;
  original_url?: string;
}

function youtubeThumbnailUrl(video: VideoExtra): string | null {
  if (video.provider !== "youtube" || !video.video_id) return null;
  return `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
}

function placeholder(message: string): string {
  return `<p><em>(${message})</em></p>`;
}

async function renderChapter(
  ch: CngRcChapter,
  storyChapter: Chapter | undefined,
  datasetMap: Map<string, Dataset | null>,
  connectionMap: Map<string, Connection>
): Promise<string> {
  const title = ch.title ? `<h2>${escapeHtml(ch.title)}</h2>` : "";
  const body = ch.body
    ? `<div class="chapter-body">${renderMarkdown(ch.body)}</div>`
    : "";

  switch (ch.type) {
    case "prose":
      return `<section class="chapter prose">${title}${body}</section>`;

    case "map":
    case "scrollytelling": {
      if (!storyChapter) {
        throw new Error(
          `Live chapter data missing for ${ch.type} chapter ${ch.id}`
        );
      }
      const dataUrl = await captureChapterMap({
        chapter: storyChapter,
        datasetMap,
        connectionMap,
      });
      const sectionClass = ch.type === "map" ? "map" : "scrolly";
      return `<section class="chapter ${sectionClass}">${title}<img src="${dataUrl}" alt="Map snapshot" />${body}</section>`;
    }

    case "image": {
      const image = (ch.extra?.image ?? {}) as ImageExtra;
      const src = image.url || image.thumbnail_url || "";
      const inlined = src ? await tryInlineAsset(src) : "";
      const alt = escapeHtml(image.alt_text ?? "");
      const media = inlined
        ? `<img src="${inlined}" alt="${alt}" />`
        : placeholder("Image unavailable");
      return `<section class="chapter image">${title}${media}${body}</section>`;
    }

    case "video": {
      const video = (ch.extra?.video ?? {}) as VideoExtra;
      const thumbnailUrl = youtubeThumbnailUrl(video);
      const inlined = thumbnailUrl ? await tryInlineAsset(thumbnailUrl) : "";
      const safeSourceUrl = video.original_url
        ? safeHttpUrl(video.original_url)
        : null;
      const media = inlined
        ? `<img src="${inlined}" alt="Video thumbnail" />`
        : placeholder("Video thumbnail unavailable");
      return `<section class="chapter video">
        ${title}
        ${media}
        ${safeSourceUrl ? `<p><small>Original video: <a href="${escapeHtml(safeSourceUrl)}">${escapeHtml(safeSourceUrl)}</a></small></p>` : ""}
        ${body}
      </section>`;
    }

    case "chart": {
      if (!storyChapter) {
        throw new Error(`Live chapter data missing for chart chapter ${ch.id}`);
      }
      if (storyChapter.type !== "chart") {
        throw new Error(
          `Live chapter type mismatch for chart chapter ${ch.id}`
        );
      }
      const dataUrl = await captureChartToDataUrl(storyChapter);
      const altText = escapeHtml(ch.title ?? "Chart");
      return `<section class="chapter chart">${title}<img src="${dataUrl}" alt="${altText}" />${body}</section>`;
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
  tags.push(
    `<meta name="dc.title" content="${escapeHtml(config.metadata.title)}">`
  );
  if (config.metadata.author) {
    tags.push(
      `<meta name="dc.creator" content="${escapeHtml(config.metadata.author)}">`
    );
  }
  tags.push(
    `<meta name="dc.date" content="${escapeHtml(config.metadata.updated)}">`
  );
  if (config.metadata.description) {
    tags.push(
      `<meta name="dc.description" content="${escapeHtml(config.metadata.description)}">`
    );
  }
  for (const layer of Object.values(config.layers)) {
    if (layer.source_url) {
      tags.push(
        `<meta name="dc.source" content="${escapeHtml(layer.source_url)}">`
      );
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
