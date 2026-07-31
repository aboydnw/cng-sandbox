import { system } from "../../theme";

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

const FONTS_LINK_ID = "cng-embed-theme-fonts";
const STYLE_ID = "cng-embed-theme-style";

function tokenVar(name: string): string {
  const cssVar = system.tokens.getByName(name)?.extensions.cssVar?.var;
  if (!cssVar) throw new Error(`Unknown theme token: ${name}`);
  return cssVar;
}

export function applyEmbedTheme(
  theme: EmbedTheme,
  doc: Document = document
): void {
  const fontsUrl = buildGoogleFontsUrl(
    [theme.bodyFont, theme.headingFont].filter((f): f is string => Boolean(f))
  );
  if (fontsUrl && !doc.getElementById(FONTS_LINK_ID)) {
    const link = doc.createElement("link");
    link.id = FONTS_LINK_ID;
    link.rel = "stylesheet";
    link.href = fontsUrl;
    link.onerror = () => {
      // Families without static 400/700 weights 400 the css2 request;
      // retry without the weight spec so the face still loads.
      link.onerror = null;
      link.href = fontsUrl.replace(/:wght@400;700/g, "");
    };
    doc.head.appendChild(link);
  }

  const rules: string[] = [];
  if (theme.bodyFont) {
    rules.push(`${tokenVar("fonts.body")}: "${theme.bodyFont}", sans-serif;`);
  }
  if (theme.headingFont) {
    rules.push(
      `${tokenVar("fonts.heading")}: "${theme.headingFont}", sans-serif;`
    );
  }
  if (theme.accent) {
    rules.push(`${tokenVar("colors.brand.orange")}: ${theme.accent};`);
    rules.push(`${tokenVar("colors.brand.orangeHover")}: ${theme.accent};`);
  }
  if (theme.bg) {
    rules.push(`${tokenVar("colors.bg")}: ${theme.bg};`);
  }
  if (rules.length === 0) return;

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = `:root {\n  ${rules.join("\n  ")}\n}`;
}
