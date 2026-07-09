import { z } from "zod";
import { config } from "../../../config";
import type { ActiveLayer, ChatTool } from "../types";

const queryPointSchema = z
  .object({ longitude: z.number(), latitude: z.number() })
  .strict();

const areaStatsSchema = z
  .object({ bbox: z.array(z.number()).length(4) })
  .strict();

const queryFeaturesSchema = z
  .object({
    collection_id: z.string().optional(),
    cql2_filter: z.string().optional(),
  })
  .strict();

const timeseriesSchema = z
  .object({ longitude: z.number(), latitude: z.number() })
  .strict();

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function rasterLayers(layers: ActiveLayer[]): ActiveLayer[] {
  return layers.filter(
    (l) => l.type === "raster-cog" && l.cogUrl && l.visible !== false
  );
}

function vectorLayers(layers: ActiveLayer[]): ActiveLayer[] {
  return layers.filter((l) => l.type === "vector-geoparquet");
}

export const dataTools: ChatTool[] = [
  {
    name: "query_point",
    schema: queryPointSchema,
    execute: async (input, bridge) => {
      const { longitude, latitude } = input as z.infer<typeof queryPointSchema>;
      const layers = rasterLayers(bridge.getActiveLayers());
      if (layers.length === 0) {
        return { summary: "No raster layer is currently shown to sample." };
      }
      const parts: string[] = [];
      for (const layer of layers) {
        const url = `${config.cogTilerUrl}/point/${longitude},${latitude}?url=${encodeURIComponent(layer.cogUrl!)}`;
        try {
          const resp = await fetch(url);
          if (!resp.ok) {
            parts.push(`${layer.label ?? layer.layer_id}: unavailable`);
            continue;
          }
          const data = await resp.json();
          const values: number[] = Array.isArray(data.values)
            ? data.values
            : [];
          const shown = values.map((v) => fmt(v)).join(", ");
          parts.push(
            `${layer.label ?? layer.layer_id} = ${shown || "no data"}`
          );
        } catch {
          parts.push(`${layer.label ?? layer.layer_id}: unavailable`);
        }
      }
      return {
        summary: `at ${fmt(latitude)},${fmt(longitude)}: ${parts.join("; ")}`,
      };
    },
  },
  {
    name: "get_area_statistics",
    schema: areaStatsSchema,
    execute: async (input, bridge) => {
      const { bbox } = input as z.infer<typeof areaStatsSchema>;
      const layers = rasterLayers(bridge.getActiveLayers());
      if (layers.length === 0) {
        return { summary: "No raster layer is currently shown to summarize." };
      }
      const layer = layers[0];
      const [w, s, e, n] = bbox;
      const feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      };
      const url = `${config.cogTilerUrl}/statistics?url=${encodeURIComponent(layer.cogUrl!)}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(feature),
        });
        if (!resp.ok)
          return { summary: "Statistics unavailable.", isError: true };
        const data = await resp.json();
        const stats: Record<
          string,
          { min: number; max: number; mean: number }
        > =
          data?.properties?.statistics ??
          data?.features?.[0]?.properties?.statistics ??
          {};
        const firstBand = stats[Object.keys(stats)[0]];
        if (!firstBand) return { summary: "No statistics returned." };
        return {
          summary: `area min ${fmt(firstBand.min)}, max ${fmt(firstBand.max)}, mean ${fmt(firstBand.mean)} (band 1)`,
        };
      } catch {
        return { summary: "Statistics unavailable.", isError: true };
      }
    },
  },
  {
    name: "query_features",
    schema: queryFeaturesSchema,
    execute: async (input, bridge) => {
      const { collection_id, cql2_filter } = input as z.infer<
        typeof queryFeaturesSchema
      >;
      const collectionId =
        collection_id ??
        vectorLayers(bridge.getActiveLayers())[0]?.collectionId;
      if (!collectionId) {
        return { summary: "No vector layer is available to query." };
      }
      const params = new URLSearchParams({ limit: "5" });
      if (cql2_filter) {
        params.set("filter-lang", "cql2-text");
        params.set("filter", cql2_filter);
      }
      const url = `${config.vectorTilerUrl}/collections/${collectionId}/items?${params.toString()}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok)
          return { summary: "Feature query failed.", isError: true };
        const data = await resp.json();
        const count = data.numberMatched ?? data.features?.length ?? 0;
        const sample = (data.features ?? [])
          .slice(0, 3)
          .map((f: { properties?: Record<string, unknown> }) => {
            const props = f.properties ?? {};
            const firstKey = Object.keys(props)[0];
            return firstKey ? String(props[firstKey]) : "?";
          })
          .join(", ");
        const tail = sample ? `; top: ${sample}` : "";
        return { summary: `${count} features match${tail}`.slice(0, 280) };
      } catch {
        return { summary: "Feature query failed.", isError: true };
      }
    },
  },
  {
    name: "get_timeseries",
    schema: timeseriesSchema,
    execute: async (_input, bridge) => {
      const layers = bridge.getActiveLayers();
      const temporal = layers.find(
        (l) => l.type === "zarr" && l.visible !== false
      );
      if (!temporal) {
        return {
          summary:
            "No time-series data is available for the layers currently shown.",
        };
      }
      // A full temporal read requires the live zarr reader, which is not yet
      // exposed on the bridge. Report honestly rather than fabricate a series.
      return {
        summary: `Time series for ${temporal.label ?? temporal.layer_id} isn't available yet in the reader agent.`,
      };
    },
  },
];
