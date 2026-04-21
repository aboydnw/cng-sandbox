import { useState, useCallback } from "react";

export type UrlRoute =
  | "xyz"
  | "pmtiles"
  | "parquet"
  | "cog"
  | "convert-url"
  | "discover";

export interface UrlDetectionResult {
  route: UrlRoute;
  url: string;
  format: string;
  isCog: boolean;
  sizeBytes: number | null;
}

interface InspectUrlResponse {
  format: string;
  is_cog: boolean;
  size_bytes: number | null;
}

interface DetectOptions {
  inspect?: (url: string) => Promise<InspectUrlResponse>;
}

async function defaultInspect(url: string): Promise<InspectUrlResponse> {
  const response = await fetch("/api/inspect-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    return { format: "unknown", is_cog: false, size_bytes: null };
  }
  return response.json();
}

function hasXyzTemplate(url: string): boolean {
  return url.includes("{z}") && url.includes("{x}") && url.includes("{y}");
}

function pathEndsWith(url: string, ext: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith(ext);
  } catch {
    return url.toLowerCase().endsWith(ext);
  }
}

export async function detectUrlRoute(
  url: string,
  options: DetectOptions = {},
): Promise<UrlDetectionResult> {
  const inspect = options.inspect ?? defaultInspect;

  // Rule 1: XYZ template (no server call needed)
  if (hasXyzTemplate(url)) {
    return { route: "xyz", url, format: "xyz", isCog: false, sizeBytes: null };
  }

  // Rule 2: PMTiles
  if (pathEndsWith(url, ".pmtiles")) {
    const probe = await inspect(url);
    return {
      route: "pmtiles",
      url,
      format: "pmtiles",
      isCog: false,
      sizeBytes: probe.size_bytes,
    };
  }

  // Rule 3: GeoParquet
  if (pathEndsWith(url, ".parquet")) {
    return { route: "parquet", url, format: "parquet", isCog: false, sizeBytes: null };
  }

  // Rule 4a: .cog extension — definitive, no probe needed
  if (pathEndsWith(url, ".cog")) {
    return { route: "cog", url, format: "cog", isCog: true, sizeBytes: null };
  }

  // Rule 5: Direct convertible formats (no inspection needed)
  if (pathEndsWith(url, ".geojson")) {
    return { route: "convert-url", url, format: "geojson", isCog: false, sizeBytes: null };
  }

  // Rules 4+5 require server probe to distinguish COG from plain TIFF
  if (
    pathEndsWith(url, ".tif") ||
    pathEndsWith(url, ".tiff")
  ) {
    const probe = await inspect(url);

    // Rule 4: COG
    if (probe.is_cog) {
      return {
        route: "cog",
        url,
        format: probe.format,
        isCog: true,
        sizeBytes: probe.size_bytes,
      };
    }

    // Rule 5: Convertible raster/vector
    return {
      route: "convert-url",
      url,
      format: probe.format,
      isCog: false,
      sizeBytes: probe.size_bytes,
    };
  }

  // Rule 6: Unknown — discovery flow
  const probe = await inspect(url);
  return {
    route: "discover",
    url,
    format: probe.format,
    isCog: probe.is_cog,
    sizeBytes: probe.size_bytes,
  };
}

export function useUrlDetection() {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async (url: string): Promise<UrlDetectionResult | null> => {
    setDetecting(true);
    setError(null);
    try {
      return await detectUrlRoute(url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
      return null;
    } finally {
      setDetecting(false);
    }
  }, []);

  return { detect, detecting, error };
}
