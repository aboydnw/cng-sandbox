interface SnapshotFilenameInput {
  title?: string | null;
  timestepIso?: string | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSnapshotFilename({
  title,
  timestepIso,
}: SnapshotFilenameInput): string {
  const slug = title ? slugify(title) : "";
  const base = slug || "map-snapshot";
  const date = timestepIso?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return date ? `${base}-${date}.png` : `${base}.png`;
}
