export interface EmbedTheme {
  bodyFont?: string;
  headingFont?: string;
  accent?: string;
  bg?: string;
}

const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]{0,58}$/;
const HEX_COLOR = /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function parseFont(value: string | null): string | undefined {
  const name = value?.trim();
  return name && FONT_NAME.test(name) ? name : undefined;
}

function parseColor(value: string | null): string | undefined {
  const hex = value?.trim().replace(/^#/, "");
  return hex && HEX_COLOR.test(hex) ? `#${hex}` : undefined;
}

export function parseEmbedTheme(params: URLSearchParams): EmbedTheme | null {
  const theme: EmbedTheme = {
    bodyFont: parseFont(params.get("bodyFont")),
    headingFont: parseFont(params.get("headingFont")),
    accent: parseColor(params.get("accent")),
    bg: parseColor(params.get("bg")),
  };
  return Object.values(theme).some(Boolean) ? theme : null;
}

export function embedThemeToParams(theme: EmbedTheme): URLSearchParams {
  const params = new URLSearchParams();
  if (theme.bodyFont) params.set("bodyFont", theme.bodyFont);
  if (theme.headingFont) params.set("headingFont", theme.headingFont);
  if (theme.accent) params.set("accent", theme.accent.replace(/^#/, ""));
  if (theme.bg) params.set("bg", theme.bg.replace(/^#/, ""));
  return params;
}

export function buildGoogleFontsUrl(families: string[]): string | null {
  const unique = [...new Set(families.filter(Boolean))];
  if (unique.length === 0) return null;
  const parts = unique.map(
    (f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;700`
  );
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}
