export function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return window.location.origin + url;
}
