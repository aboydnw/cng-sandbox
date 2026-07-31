import { describe, it, expect, beforeEach } from "vitest";
import {
  parseEmbedTheme,
  embedThemeToParams,
  buildGoogleFontsUrl,
  applyEmbedTheme,
} from "../embedTheme";
import { system } from "../../../theme";

function tokenVar(name: string): string {
  const cssVar = system.tokens.getByName(name)?.extensions.cssVar?.var;
  if (!cssVar) throw new Error(`missing token ${name}`);
  return cssVar;
}

describe("parseEmbedTheme", () => {
  it("parses all four params", () => {
    const params = new URLSearchParams(
      "bodyFont=Libre+Baskerville&headingFont=Archivo&accent=2f6f4f&bg=FCFBF9"
    );
    expect(parseEmbedTheme(params)).toEqual({
      bodyFont: "Libre Baskerville",
      headingFont: "Archivo",
      accent: "#2f6f4f",
      bg: "#FCFBF9",
    });
  });

  it("returns null when no theme params are present", () => {
    expect(
      parseEmbedTheme(new URLSearchParams("config=https://x/y.json"))
    ).toBeNull();
  });

  it("drops invalid values but keeps valid ones", () => {
    const params = new URLSearchParams(
      "bodyFont=Inter&headingFont=<script>alert(1)</script>&accent=notahex&bg=333"
    );
    expect(parseEmbedTheme(params)).toEqual({
      bodyFont: "Inter",
      headingFont: undefined,
      accent: undefined,
      bg: "#333",
    });
  });

  it("accepts a leading # on colors", () => {
    const params = new URLSearchParams("accent=%23CF3F02");
    expect(parseEmbedTheme(params)).toEqual({
      bodyFont: undefined,
      headingFont: undefined,
      accent: "#CF3F02",
      bg: undefined,
    });
  });
});

describe("embedThemeToParams", () => {
  it("serializes set values and strips # from colors", () => {
    const params = embedThemeToParams({
      bodyFont: "Libre Baskerville",
      accent: "#2f6f4f",
    });
    expect(params.get("bodyFont")).toBe("Libre Baskerville");
    expect(params.get("accent")).toBe("2f6f4f");
    expect(params.has("headingFont")).toBe(false);
    expect(params.has("bg")).toBe(false);
  });

  it("round-trips through parseEmbedTheme", () => {
    const theme = {
      bodyFont: "Libre Baskerville",
      headingFont: "Archivo",
      accent: "#2f6f4f",
      bg: "#ffffff",
    };
    expect(parseEmbedTheme(embedThemeToParams(theme))).toEqual(theme);
  });
});

describe("applyEmbedTheme", () => {
  beforeEach(() => {
    document.getElementById("cng-embed-theme-fonts")?.remove();
    document.getElementById("cng-embed-theme-style")?.remove();
  });

  it("injects a Google Fonts link and a :root override style", () => {
    applyEmbedTheme({
      bodyFont: "Libre Baskerville",
      headingFont: "Archivo",
      accent: "#2f6f4f",
      bg: "#f0ede8",
    });

    const link = document.getElementById(
      "cng-embed-theme-fonts"
    ) as HTMLLinkElement;
    expect(link.href).toContain("family=Libre+Baskerville");
    expect(link.href).toContain("family=Archivo");

    const style = document.getElementById("cng-embed-theme-style")!;
    expect(style.textContent).toContain(
      `${tokenVar("fonts.body")}: "Libre Baskerville"`
    );
    expect(style.textContent).toContain(
      `${tokenVar("fonts.heading")}: "Archivo"`
    );
    expect(style.textContent).toContain(
      `${tokenVar("colors.brand.orange")}: #2f6f4f`
    );
    expect(style.textContent).toContain(
      `${tokenVar("colors.brand.orangeHover")}: #2f6f4f`
    );
    expect(style.textContent).toContain(`${tokenVar("colors.bg")}: #f0ede8`);
  });

  it("skips the fonts link when no fonts are set and is idempotent", () => {
    applyEmbedTheme({ accent: "#112233" });
    applyEmbedTheme({ accent: "#112233" });

    expect(document.getElementById("cng-embed-theme-fonts")).toBeNull();
    expect(document.querySelectorAll("#cng-embed-theme-style")).toHaveLength(1);
  });

  it("does nothing for an empty theme", () => {
    applyEmbedTheme({});
    expect(document.getElementById("cng-embed-theme-style")).toBeNull();
    expect(document.getElementById("cng-embed-theme-fonts")).toBeNull();
  });
});

describe("buildGoogleFontsUrl", () => {
  it("builds a css2 URL with plus-encoded names and weights", () => {
    expect(buildGoogleFontsUrl(["Libre Baskerville", "Archivo"])).toBe(
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Archivo:wght@400;700&display=swap"
    );
  });

  it("dedupes families and returns null for an empty list", () => {
    expect(buildGoogleFontsUrl(["Inter", "Inter"])).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
    );
    expect(buildGoogleFontsUrl([])).toBeNull();
  });
});
