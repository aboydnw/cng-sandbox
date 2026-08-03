import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";
import { connectionsApi, workspaceFetch } from "../lib/api";
import type { Connection, Dataset } from "../types";
import { listStoriesFromServer } from "../lib/story/api";
import type { Story } from "../lib/story/types";

export type ResourceStatus = "loading" | "ready" | "empty" | "error";

export interface ResourceState<T> {
  status: ResourceStatus;
  data: T[];
  error: string | null;
  retry: () => void;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useWorkspaceDatasets(): ResourceState<Dataset> {
  const [data, setData] = useState<Dataset[]>([]);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const requestRef = useRef(0);

  const retry = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    workspaceFetch(`${config.apiBase}/api/datasets`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as Dataset[];
      })
      .then((next) => {
        if (requestId !== requestRef.current) return;
        setData(next);
        setStatus(next.length === 0 ? "empty" : "ready");
      })
      .catch((cause) => {
        if (controller.signal.aborted || requestId !== requestRef.current)
          return;
        setStatus("error");
        setError(message(cause, "Couldn’t load datasets"));
      });

    return () => controller.abort();
  }, [request]);

  return { data, status, error, retry };
}

export function useWorkspaceConnections(): ResourceState<Connection> {
  const [data, setData] = useState<Connection[]>([]);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const requestRef = useRef(0);

  const retry = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setStatus("loading");
    setError(null);

    connectionsApi
      .list()
      .then((next) => {
        if (requestId !== requestRef.current) return;
        setData(next);
        setStatus(next.length === 0 ? "empty" : "ready");
      })
      .catch((cause) => {
        if (requestId !== requestRef.current) return;
        setStatus("error");
        setError(message(cause, "Couldn’t load connections"));
      });

    return () => {
      requestRef.current += 1;
    };
  }, [request]);

  return { data, status, error, retry };
}

export function useWorkspaceStories(): ResourceState<Story> {
  const [data, setData] = useState<Story[]>([]);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const requestRef = useRef(0);

  const retry = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setStatus("loading");
    setError(null);

    listStoriesFromServer()
      .then((next) => {
        if (requestId !== requestRef.current) return;
        setData(next);
        setStatus(next.length === 0 ? "empty" : "ready");
      })
      .catch((cause) => {
        if (requestId !== requestRef.current) return;
        setStatus("error");
        setError(message(cause, "Couldn’t load stories"));
      });

    return () => {
      requestRef.current += 1;
    };
  }, [request]);

  return { data, status, error, retry };
}
