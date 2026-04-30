import type { CngRcConfig } from "../cngRcTypes";

/**
 * Render the data-citations `<section>` for the archival HTML, listing every
 * referenced layer with its label, attribution, and source URLs. Returns "" if
 * the story has no layers.
 */
export function buildCitationBlock(config: CngRcConfig): string {
  const layers = Object.values(config.layers);
  if (layers.length === 0) return "";

  const rows = layers.map((layer) => `
    <li>
      <strong>${escapeHtml(layer.label ?? "(unnamed layer)")}</strong>
      ${layer.attribution ? ` — ${escapeHtml(layer.attribution)}` : ""}
      <br />
      <small>
        ${urlPart(layer.source_url, "Source")}
        ${layer.cng_url ? ` &middot; ${urlPart(layer.cng_url, "CNG mirror")}` : ""}
      </small>
    </li>
  `.trim());

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
  return `<a href="${escapeAttr(url)}">${label}: ${escapeHtml(url)}</a>`;
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
