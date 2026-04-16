export interface NameableDataset {
  title?: string | null;
  filename: string;
}

export function displayName(ds: NameableDataset): string {
  return ds.title && ds.title.length > 0 ? ds.title : ds.filename;
}
