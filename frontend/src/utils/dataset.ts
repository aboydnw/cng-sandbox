export interface NameableDataset {
  title?: string | null;
  filename: string;
}

export function displayName(ds: NameableDataset): string {
  const title = ds.title?.trim();
  return title && title.length > 0 ? title : ds.filename;
}
