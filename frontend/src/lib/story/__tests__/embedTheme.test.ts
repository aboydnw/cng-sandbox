import { describe, it, expect } from "vitest";
import {
  parseEmbedTheme,
  embedThemeToParams,
  buildGoogleFontsUrl,
} from "../embedTheme";

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
