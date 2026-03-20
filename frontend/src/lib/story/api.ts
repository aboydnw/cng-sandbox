import type { Story } from "./types";
import { config } from "../../config";

const BASE = `${config.apiBase}/api/stories`;

export async function createStoryOnServer(story: Omit<Story, "id" | "created_at">): Promise<Story> {
  const resp = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(story),
  });
  if (!resp.ok) throw new Error(`Failed to create story: ${resp.status}`);
  return resp.json();
}

export async function getStoryFromServer(id: string): Promise<Story | null> {
  const resp = await fetch(`${BASE}/${id}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to load story: ${resp.status}`);
  return resp.json();
}

export async function listStoriesFromServer(): Promise<Story[]> {
  const resp = await fetch(BASE);
  if (!resp.ok) throw new Error(`Failed to list stories: ${resp.status}`);
  return resp.json();
}

export async function saveStoryToServer(story: Story): Promise<Story> {
  const resp = await fetch(`${BASE}/${story.id}`, {
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
  const resp = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`Failed to delete story: ${resp.status}`);
}
