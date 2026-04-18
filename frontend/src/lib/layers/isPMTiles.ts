export function isPMTilesDataset(ds: {
  format_pair?: string;
  tile_url?: string;
}): boolean {
  if (ds.format_pair === "pmtiles") return true;
  if (ds.tile_url?.startsWith("/pmtiles/")) return true;
  return false;
}
