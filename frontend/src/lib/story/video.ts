export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
  provider: VideoProvider;
  video_id: string;
}

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

export function parseVideoUrl(input: string): ParsedVideo | null {
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if (YT_HOSTS.has(host)) {
    if (host === "youtu.be") {
      const id = path.replace(/^\//, "").split("/")[0];
      return id ? { provider: "youtube", video_id: id } : null;
    }
    if (path === "/watch") {
      const id = u.searchParams.get("v");
      return id ? { provider: "youtube", video_id: id } : null;
    }
    const m = path.match(/^\/(embed|shorts)\/([^/]+)/);
    if (m) return { provider: "youtube", video_id: m[2] };
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    const m =
      path.match(/^\/video\/(\d+)/) ?? path.match(/^\/(\d+)(?:\/|$)/);
    return m ? { provider: "vimeo", video_id: m[1] } : null;
  }

  return null;
}

export function buildEmbedUrl(parsed: ParsedVideo): string {
  if (parsed.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${parsed.video_id}?rel=0`;
  }
  return `https://player.vimeo.com/video/${parsed.video_id}`;
}
