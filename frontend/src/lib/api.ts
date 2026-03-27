import type { Connection } from "../types";

let _workspaceId = "";

export function setWorkspaceId(id: string): void {
  _workspaceId = id;
}

export function getWorkspaceId(): string {
  return _workspaceId;
}

export function workspaceFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (_workspaceId) {
    headers.set("X-Workspace-Id", _workspaceId);
  }
  return fetch(input, { ...init, headers });
}

export const connectionsApi = {
  list(): Promise<Connection[]> {
    return workspaceFetch("/api/connections").then((r) => r.json());
  },

  get(id: string): Promise<Connection> {
    return workspaceFetch(`/api/connections/${id}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  },

  create(body: {
    name: string;
    url: string;
    connection_type: string;
    bounds?: number[] | null;
    min_zoom?: number | null;
    max_zoom?: number | null;
    tile_type?: string | null;
    band_count?: number | null;
    rescale?: string | null;
  }): Promise<Connection> {
    return workspaceFetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  },

  delete(id: string): Promise<void> {
    return workspaceFetch(`/api/connections/${id}`, {
      method: "DELETE",
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    });
  },
};
