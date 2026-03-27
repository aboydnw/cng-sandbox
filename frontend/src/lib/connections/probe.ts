import { PMTiles } from "pmtiles";

export interface ProbeMetadata {
  tileType: "raster" | "vector";
  bounds: [number, number, number, number] | null;
  minZoom: number | null;
  maxZoom: number | null;
  bandCount: number | null;
  rescale: [number, number] | null;
}

/** @deprecated Use ProbeMetadata instead */
export type PMTilesMetadata = ProbeMetadata;

export async function probePMTiles(url: string): Promise<ProbeMetadata> {
  // Route through our proxy to avoid CORS issues with external servers
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  const source = new PMTiles(proxyUrl);
  const header = await source.getHeader();

  // PMTiles TileType enum: 0=unknown, 1=mvt, 2=png, 3=jpeg, 4=webp, 5=avif
  const tileType = header.tileType === 1 ? "vector" : "raster";

  const bounds: [number, number, number, number] | null =
    header.minLon !== undefined &&
    header.minLat !== undefined &&
    header.maxLon !== undefined &&
    header.maxLat !== undefined
      ? [header.minLon, header.minLat, header.maxLon, header.maxLat]
      : null;

  return {
    tileType,
    bounds,
    minZoom: header.minZoom ?? null,
    maxZoom: header.maxZoom ?? null,
    bandCount: null,
    rescale: null,
  };
}

export async function probeCOG(url: string): Promise<ProbeMetadata> {
  const encodedUrl = encodeURIComponent(url);
  const [tjResp, infoResp] = await Promise.all([
    fetch(`/cog/WebMercatorQuad/tilejson.json?url=${encodedUrl}`),
    fetch(`/cog/info?url=${encodedUrl}`),
  ]);
  if (!tjResp.ok) throw new Error(`COG probe failed: ${tjResp.status}`);
  const tj = await tjResp.json();

  let bandCount: number | null = null;
  let rescale: [number, number] | null = null;
  if (infoResp.ok) {
    const info = await infoResp.json();
    bandCount = info.count ?? null;

    // For single-band non-byte data, fetch statistics to get the value range
    if (bandCount === 1 && info.dtype && info.dtype !== "uint8") {
      try {
        const statsResp = await fetch(`/cog/statistics?url=${encodedUrl}`);
        if (statsResp.ok) {
          const stats = await statsResp.json();
          const b1 = stats.b1;
          if (b1 && b1.percentile_2 != null && b1.percentile_98 != null) {
            rescale = [b1.percentile_2, b1.percentile_98];
          }
        }
      } catch {
        // Statistics are optional — fall back to no rescale
      }
    }
  }

  return {
    tileType: "raster",
    bounds: tj.bounds ?? null,
    minZoom: tj.minzoom ?? null,
    maxZoom: tj.maxzoom ?? null,
    bandCount,
    rescale,
  };
}
