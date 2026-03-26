import type { Story } from "./types";
import { config } from "../../config";
import { workspaceFetch } from "../api";

const BASE = `${config.apiBase}/api/stories`;

export async function createStoryOnServer(
  story: Omit<Story, "id" | "created_at">
): Promise<Story> {
  const resp = await workspaceFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: story.title,
      description: story.description,
      dataset_id: story.dataset_id,
      chapters: story.chapters,
      published: story.published,
    }),
  });
  if (!resp.ok) throw new Error(`Failed to create story: ${resp.status}`);
  return resp.json();
}

export async function getStoryFromServer(id: string): Promise<Story | null> {
  const resp = await workspaceFetch(`${BASE}/${id}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to load story: ${resp.status}`);
  return resp.json();
}

export async function listStoriesFromServer(): Promise<Story[]> {
  const resp = await workspaceFetch(BASE);
  if (!resp.ok) throw new Error(`Failed to list stories: ${resp.status}`);
  return resp.json();
}

export async function saveStoryToServer(story: Story): Promise<Story> {
  const resp = await workspaceFetch(`${BASE}/${story.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: story.title,
      description: story.description,
      chapters: story.chapters,
      published: story.published,
    }),
  });
  if (!resp.ok) throw new Error(`Failed to save story: ${resp.status}`);
  return resp.json();
}

export async function deleteStoryFromServer(id: string): Promise<void> {
  const resp = await workspaceFetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`Failed to delete story: ${resp.status}`);
}
