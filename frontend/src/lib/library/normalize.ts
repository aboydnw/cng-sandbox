import type { Dataset, Connection } from "../../types";
import { displayName } from "../../utils/dataset";

export type LibrarySource = "upload" | "connection";

export interface LibraryItem {
  id: string;
  kind: LibrarySource;
  name: string;
  type: "raster" | "vector";
  source: { label: string; href?: string };
  addedAt: string;
  detailHref: string;
  raw:
    | { kind: "dataset"; dataset: Dataset }
    | { kind: "connection"; connection: Connection };
}

export function datasetToLibraryItem(ds: Dataset): LibraryItem {
  return {
    id: ds.id,
    kind: "upload",
    name: displayName(ds),
    type: ds.dataset_type,
    source: { label: "Uploaded" },
    addedAt: ds.created_at,
    detailHref: `/map/${ds.id}`,
    raw: { kind: "dataset", dataset: ds },
  };
}

function connectionTypeToKind(conn: Connection): "raster" | "vector" {
  switch (conn.connection_type) {
    case "cog":
    case "xyz_raster":
      return "raster";
    case "xyz_vector":
    case "geoparquet":
      return "vector";
    case "pmtiles":
      return conn.tile_type === "raster" ? "raster" : "vector";
    default:
      return "vector";
  }
}

export function connectionToLibraryItem(conn: Connection): LibraryItem {
  return {
    id: conn.id,
    kind: "connection",
    name: conn.name,
    type: connectionTypeToKind(conn),
    source: { label: conn.url, href: conn.url },
    addedAt: conn.created_at,
    detailHref: `/map/connection/${conn.id}`,
    raw: { kind: "connection", connection: conn },
  };
}
