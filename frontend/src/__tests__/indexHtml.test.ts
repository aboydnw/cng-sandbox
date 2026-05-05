import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const HTML = readFileSync(
  resolve(__dirname, "..", "..", "index.html"),
  "utf-8"
);

describe("index.html head metadata", () => {
  it("has a descriptive title", () => {
    expect(HTML).toMatch(
      /<title>CNG Sandbox — Cloud-native geospatial data conversion<\/title>/
    );
  });

  it("declares a meta description", () => {
    expect(HTML).toMatch(
      /<meta\s+name="description"\s+content="[^"]{40,}"/
    );
  });

  it("declares a canonical URL", () => {
    expect(HTML).toMatch(
      /<link\s+rel="canonical"\s+href="https:\/\/storytelling\.developmentseed\.org\/"/
    );
  });

  it("declares a theme-color", () => {
    expect(HTML).toMatch(/<meta\s+name="theme-color"\s+content="#CF3F02"/);
  });

  it("declares Open Graph tags", () => {
    expect(HTML).toMatch(/property="og:title"/);
    expect(HTML).toMatch(/property="og:description"/);
    expect(HTML).toMatch(/property="og:image"/);
    expect(HTML).toMatch(/property="og:url"/);
    expect(HTML).toMatch(/property="og:type"\s+content="website"/);
  });

  it("declares Twitter Card tags", () => {
    expect(HTML).toMatch(
      /<meta\s+name="twitter:card"\s+content="summary_large_image"/
    );
  });

  it("links a favicon, apple touch icon, and webmanifest", () => {
    expect(HTML).toMatch(/rel="icon"[^>]*href="\/favicon\.ico"/);
    expect(HTML).toMatch(
      /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/
    );
    expect(HTML).toMatch(/rel="manifest"\s+href="\/site\.webmanifest"/);
  });

  it("embeds a JSON-LD WebApplication block", () => {
    expect(HTML).toMatch(
      /<script\s+type="application\/ld\+json">[\s\S]*"@type":\s*"WebApplication"[\s\S]*<\/script>/
    );
  });
});
