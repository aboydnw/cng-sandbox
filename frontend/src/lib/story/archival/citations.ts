import type { CngRcConfig } from "../cngRcTypes";

/**
 * Render the data-citations `<section>` for the archival HTML, listing every
 * referenced layer with its label, attribution, and source URLs. Returns "" if
 * the story has no layers.
 */
export function buildCitationBlock(config: CngRcConfig): string {
  const layers = Object.values(config.layers);
  if (layers.length === 0) return "";

  const rows = layers.map((layer) =>
    `
    <li>
      <strong>${escapeHtml(layer.label ?? "(unnamed layer)")}</strong>
      ${layer.attribution ? ` — ${escapeHtml(layer.attribution)}` : ""}
      <br />
      <small>
        ${urlPart(layer.source_url, "Source")}
        ${layer.cng_url ? ` &middot; ${urlPart(layer.cng_url, "CNG mirror")}` : ""}
      </small>
    </li>
  `.trim()
  );

  return `
<section class="citations">
  <h2>Data citations</h2>
  <ul>
    ${rows.join("\n")}
  </ul>
</section>
  `.trim();
}

function urlPart(url: string | null, label: string): string {
  if (!url) return "";
  const safe = safeHttpUrl(url);
  if (safe) {
    return `<a href="${escapeAttr(safe)}">${label}: ${escapeHtml(safe)}</a>`;
  }
  return `${label}: ${escapeHtml(url)}`;
}

/**
 * Return the input URL if it parses and uses an http(s) scheme, else null.
 * Blocks `javascript:`, `data:`, and other potentially-unsafe schemes from
 * being emitted as live links in the archival HTML.
 */
export function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Escape HTML special characters (&, <, >, ") so user-provided strings are
 * safe to interpolate into element content or quoted attribute values.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
