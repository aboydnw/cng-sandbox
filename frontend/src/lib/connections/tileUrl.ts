import type { Connection } from "../../types";

export function buildConnectionTileUrl(connection: Connection): string {
  switch (connection.connection_type) {
    case "cog":
      return `/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(connection.url)}`;
    case "pmtiles":
    case "xyz_raster":
    case "xyz_vector":
    case "geoparquet":
      return connection.url;
    default:
      return connection.url;
  }
}
