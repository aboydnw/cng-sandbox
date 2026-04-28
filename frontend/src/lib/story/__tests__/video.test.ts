import { describe, it, expect } from "vitest";
import { parseVideoUrl } from "../video";

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("parses YouTube URL %s -> %s", (url, id) => {
    const r = parseVideoUrl(url);
    expect(r).toEqual({ provider: "youtube", video_id: id });
  });

  it.each([
    ["https://vimeo.com/123456789", "123456789"],
    ["https://www.vimeo.com/123456789", "123456789"],
    ["https://player.vimeo.com/video/123456789", "123456789"],
  ])("parses Vimeo URL %s -> %s", (url, id) => {
    const r = parseVideoUrl(url);
    expect(r).toEqual({ provider: "vimeo", video_id: id });
  });

  it("returns null for unrecognized URLs", () => {
    expect(parseVideoUrl("https://example.com/video")).toBeNull();
    expect(parseVideoUrl("not a url")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });

  it("rejects non-HTTP(S) schemes even on supported hosts", () => {
    expect(parseVideoUrl("ftp://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
  });
});
