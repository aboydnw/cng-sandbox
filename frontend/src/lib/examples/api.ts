import { workspaceFetch } from "../api";

export interface ExampleState {
  state: "seeded" | "removed" | "none";
}

export interface SeedResult {
  state: "seeded";
  story_id_map: Record<string, string>;
}

export async function getExampleState(
  workspaceId: string
): Promise<ExampleState> {
  const resp = await workspaceFetch(`/api/workspaces/${workspaceId}/examples`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function seedExampleData(
  workspaceId: string
): Promise<SeedResult> {
  const resp = await workspaceFetch(`/api/workspaces/${workspaceId}/examples`, {
    method: "POST",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function removeExampleData(workspaceId: string): Promise<void> {
  const resp = await workspaceFetch(`/api/workspaces/${workspaceId}/examples`, {
    method: "DELETE",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
}
