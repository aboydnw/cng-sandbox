import type { Connection } from "../../types";

export function buildConnectionTileUrl(connection: Connection): string {
  switch (connection.connection_type) {
    case "cog":
      return `/raster/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(connection.url)}`;
    case "pmtiles":
    case "xyz_raster":
    case "xyz_vector":
      return connection.url;
    default:
      return connection.url;
  }
}
