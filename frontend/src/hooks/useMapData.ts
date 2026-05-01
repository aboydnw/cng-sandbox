import { useState, useEffect, useCallback } from "react";
import { connectionsApi, workspaceFetch } from "../lib/api";
import { buildConnectionTileUrl } from "../lib/connections";
import type { Dataset, Connection, MapItem } from "../types";
import { displayName } from "../utils/dataset";

export function datasetToMapItem(ds: Dataset): MapItem {
  return {
    id: ds.id,
    name: displayName(ds),
    source: "dataset",
    dataType: ds.dataset_type,
    tileUrl: ds.tile_url,
    bounds: ds.bounds,
    minZoom: ds.min_zoom,
    maxZoom: ds.max_zoom,
    bandCount: ds.band_count,
    bandNames: ds.band_names,
    colorInterpretation: ds.color_interpretation,
    dtype: ds.dtype,
    rasterMin: ds.raster_min,
    rasterMax: ds.raster_max,
    isCategorical: ds.is_categorical,
    categories: ds.categories,
    cogUrl: ds.cog_url,
    crs: ds.crs,
    rescale: null,
    parquetUrl: ds.parquet_url,
    isTemporal: ds.is_temporal,
    timesteps: ds.timesteps,
    renderMode: ds.render_mode ?? null,
    preferredColormap: ds.preferred_colormap ?? null,
    preferredColormapReversed: ds.preferred_colormap_reversed ?? null,
    dataset: ds,
    connection: null,
  };
}

function getConnectionDataType(conn: Connection): "raster" | "vector" {
  if (conn.connection_type === "xyz_vector") return "vector";
  if (conn.connection_type === "geoparquet") return "vector";
  if (conn.connection_type === "pmtiles" && conn.tile_type !== "raster")
    return "vector";
  return "raster";
}

interface ZarrConfigShape {
  variable?: string;
  timeDim?: string | null;
  timesteps?: { datetime: string; index: number }[] | null;
  /** Legacy field — older saved connections stored a flat string array. */
  timeValues?: string[] | null;
  rescaleMin?: number | null;
  rescaleMax?: number | null;
}

interface ParsedZarrFields {
  isTemporal: boolean;
  timesteps: { datetime: string; index: number }[];
  rasterMin: number | null;
  rasterMax: number | null;
}

function parseZarrConfig(
  config: Record<string, unknown> | null | undefined
): ParsedZarrFields {
  if (!config) {
    return {
      isTemporal: false,
      timesteps: [],
      rasterMin: null,
      rasterMax: null,
    };
  }
  const c = config as ZarrConfigShape;
  const hasTime = !!c.timeDim;
  const parsedTimesteps = Array.isArray(c.timesteps)
    ? c.timesteps.filter(
        (t): t is { datetime: string; index: number } =>
          !!t &&
          typeof t.datetime === "string" &&
          typeof t.index === "number" &&
          Number.isInteger(t.index) &&
          t.index >= 0
      )
    : null;
  const legacyTimesteps =
    parsedTimesteps === null && Array.isArray(c.timeValues)
      ? c.timeValues
          .map((datetime, index) => ({ datetime, index }))
          .filter(
            (t): t is { datetime: string; index: number } =>
              typeof t.datetime === "string"
          )
      : [];
  const timesteps = parsedTimesteps ?? legacyTimesteps;
  return {
    isTemporal: hasTime && timesteps.length > 0,
    timesteps,
    rasterMin: typeof c.rescaleMin === "number" ? c.rescaleMin : null,
    rasterMax: typeof c.rescaleMax === "number" ? c.rescaleMax : null,
  };
}

export function connectionToMapItem(conn: Connection): MapItem {
  const isZarr = conn.connection_type === "zarr";
  const zarrFields = isZarr
    ? parseZarrConfig(conn.config)
    : {
        isTemporal: false,
        timesteps: [] as { datetime: string; index: number }[],
        rasterMin: null,
        rasterMax: null,
      };

  return {
    id: conn.id,
    name: conn.name,
    source: "connection",
    dataType: getConnectionDataType(conn),
    tileUrl: buildConnectionTileUrl(conn),
    bounds: conn.bounds,
    minZoom: conn.min_zoom,
    maxZoom: conn.max_zoom,
    bandCount: isZarr ? 1 : conn.band_count,
    bandNames: null,
    colorInterpretation: null,
    dtype: null,
    rasterMin: zarrFields.rasterMin,
    rasterMax: zarrFields.rasterMax,
    isCategorical: conn.is_categorical,
    categories: conn.categories,
    cogUrl: conn.connection_type === "cog" ? conn.url : null,
    crs: null,
    rescale: conn.rescale,
    parquetUrl: null,
    isTemporal: zarrFields.isTemporal,
    timesteps: zarrFields.timesteps,
    renderMode: conn.render_mode ?? null,
    preferredColormap: conn.preferred_colormap ?? null,
    preferredColormapReversed: conn.preferred_colormap_reversed ?? null,
    dataset: null,
    connection: conn,
  };
}

interface UseMapDataResult {
  data: MapItem | null;
  isLoading: boolean;
  error: string | null;
  isExpired: boolean;
  refresh: () => void;
}

export function useMapData(
  id: string | undefined,
  isConnection: boolean
): UseMapDataResult {
  const [data, setData] = useState<MapItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    let ignore = false;

    if (!id) {
      setData(null);
      setError(null);
      setIsExpired(false);
      setIsLoading(false);
      return () => {
        ignore = true;
      };
    }

    setIsLoading(true);
    setError(null);
    setData(null);
    setIsExpired(false);

    if (isConnection) {
      connectionsApi
        .get(id)
        .then((conn) => {
          if (!ignore) setData(connectionToMapItem(conn));
        })
        .catch((e) => {
          if (!ignore)
            setError(
              e instanceof Error ? e.message : "Failed to load connection"
            );
        })
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });
    } else {
      workspaceFetch(`/api/datasets/${id}`)
        .then((resp) => {
          if (resp.status === 404) {
            if (!ignore) setIsExpired(true);
            return null;
          }
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.json();
        })
        .then((ds: Dataset | null) => {
          if (!ds || ignore) return;
          const created = new Date(ds.created_at);
          const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (new Date() > expiry) {
            setIsExpired(true);
            return;
          }
          setData(datasetToMapItem(ds));
        })
        .catch((e) => {
          if (!ignore)
            setError(e instanceof Error ? e.message : "Failed to load dataset");
        })
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [id, isConnection]);

  const refresh = useCallback(() => {
    if (!id) return;
    if (isConnection) {
      connectionsApi
        .get(id)
        .then((conn) => {
          setData(connectionToMapItem(conn));
          setError(null);
        })
        .catch((e) => {
          setError(
            e instanceof Error ? e.message : "Failed to refresh connection"
          );
        });
    } else {
      workspaceFetch(`/api/datasets/${id}`)
        .then((resp) => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.json();
        })
        .then((ds: Dataset) => {
          setData(datasetToMapItem(ds));
          setError(null);
        })
        .catch((e) => {
          setError(
            e instanceof Error ? e.message : "Failed to refresh dataset"
          );
        });
    }
  }, [id, isConnection]);

  return { data, isLoading, error, isExpired, refresh };
}
