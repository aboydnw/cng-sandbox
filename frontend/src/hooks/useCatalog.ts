import { useState, useEffect, useCallback } from "react";
import { config } from "../config";

interface Provider {
  id: string;
  name: string;
  description: string;
}

interface StacCollection {
  id: string;
  title?: string;
  description?: string;
  extent?: unknown;
  keywords?: string[];
}

export interface StacItem {
  id: string;
  type: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  assets: Record<string, { href: string; type?: string; title?: string }>;
  bbox?: number[];
}

interface SearchFilters {
  collections: string[];
  bbox?: number[];
  datetime?: string;
  cloudCover?: number;
  limit?: number;
}

export function useCatalog() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [collections, setCollections] = useState<StacCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [results, setResults] = useState<StacItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<StacItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalMatched, setTotalMatched] = useState<number | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${config.apiBase}/api/catalog/providers`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("providers_unavailable"))))
      .then(setProviders)
      .catch(() => setError("Could not connect to the catalog service"));
  }, []);

  const selectProvider = useCallback(async (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedCollection(null);
    setResults([]);
    setSelectedItem(null);
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch(`${config.apiBase}/api/catalog/${providerId}/collections`);
      if (!resp.ok) throw new Error("collections_unavailable");
      const data = await resp.json();
      setCollections(data.collections || []);
    } catch {
      setError("Earth Search is temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCollection = useCallback((collectionId: string) => {
    setSelectedCollection(collectionId);
    setResults([]);
    setSelectedItem(null);
  }, []);

  const _buildSearchBody = (filters: SearchFilters, token?: string | null) => {
    const body: Record<string, unknown> = {
      collections: filters.collections,
      limit: filters.limit || 20,
    };
    if (filters.bbox) body.bbox = filters.bbox;
    if (filters.datetime) body.datetime = filters.datetime;
    if (filters.cloudCover != null) {
      body.filter = {
        op: "<=",
        args: [{ property: "eo:cloud_cover" }, filters.cloudCover],
      };
      body["filter_lang"] = "cql2-json";
    }
    if (token) body.token = token;
    return body;
  };

  const search = useCallback(async (filters: SearchFilters) => {
    if (!selectedProvider) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${config.apiBase}/api/catalog/${selectedProvider}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(_buildSearchBody(filters)),
      });
      if (!resp.ok) throw new Error("search_failed");
      const data = await resp.json();
      setResults(data.features || []);
      setTotalMatched(data.context?.matched ?? data.numberMatched ?? null);
      setNextToken(data.links?.find((l: { rel: string }) => l.rel === "next")?.body?.token ?? null);
    } catch {
      setError("Earth Search is temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  const loadMore = useCallback(async (filters: SearchFilters) => {
    if (!selectedProvider || !nextToken) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${config.apiBase}/api/catalog/${selectedProvider}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(_buildSearchBody(filters, nextToken)),
      });
      if (!resp.ok) throw new Error("search_failed");
      const data = await resp.json();
      setResults((prev) => [...prev, ...(data.features || [])]);
      setTotalMatched(data.context?.matched ?? data.numberMatched ?? null);
      setNextToken(data.links?.find((l: { rel: string }) => l.rel === "next")?.body?.token ?? null);
    } catch {
      setError("Earth Search is temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, nextToken]);

  const selectItem = useCallback((item: StacItem | null) => {
    setSelectedItem(item);
  }, []);

  const reset = useCallback(() => {
    setSelectedProvider(null);
    setCollections([]);
    setSelectedCollection(null);
    setResults([]);
    setSelectedItem(null);
    setError(null);
    setTotalMatched(null);
    setNextToken(null);
  }, []);

  return {
    providers,
    selectedProvider,
    collections,
    selectedCollection,
    results,
    selectedItem,
    loading,
    error,
    totalMatched,
    hasMore: nextToken != null,
    selectProvider,
    selectCollection,
    search,
    loadMore,
    selectItem,
    reset,
  };
}
