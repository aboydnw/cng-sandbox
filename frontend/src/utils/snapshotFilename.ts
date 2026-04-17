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
  const date = timestepIso ? timestepIso.slice(0, 10) : null;
  return date ? `${base}-${date}.png` : `${base}.png`;
}
