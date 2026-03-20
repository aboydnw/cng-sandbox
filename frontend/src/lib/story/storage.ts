import type { Story, StoryIndexEntry } from "./types";

const INDEX_KEY = "story:index";

function storyKey(id: string): string {
  return `story:${id}`;
}

function readIndex(): StoryIndexEntry[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeIndex(entries: StoryIndexEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function listStories(): StoryIndexEntry[] {
  return readIndex();
}

export function getStory(id: string): Story | null {
  const raw = localStorage.getItem(storyKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStory(story: Story): void {
  localStorage.setItem(storyKey(story.id), JSON.stringify(story));

  const index = readIndex();
  const existing = index.findIndex((e) => e.id === story.id);
  const entry: StoryIndexEntry = {
    id: story.id,
    title: story.title,
    dataset_id: story.dataset_id,
    created_at: story.created_at,
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
  writeIndex(index);
}

export function deleteStory(id: string): void {
  localStorage.removeItem(storyKey(id));
  const index = readIndex().filter((e) => e.id !== id);
  writeIndex(index);
}
