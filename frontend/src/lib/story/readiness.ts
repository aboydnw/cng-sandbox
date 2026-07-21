import type { Chapter, Story } from "./types";

export interface ReadinessIssue {
  id: string;
  message: string;
  chapterId?: string;
}

export interface StoryReadiness {
  blocking: ReadinessIssue[];
  advisory: ReadinessIssue[];
  readyToPublish: boolean;
}

export function chapterReadiness(chapter: Chapter): {
  complete: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!chapter.title.trim()) issues.push("Add a chapter title");
  if (!chapter.narrative.trim()) issues.push("Add reader-facing text");

  if (
    (chapter.type === "map" || chapter.type === "scrollytelling") &&
    !chapter.layer_config.dataset_id &&
    !chapter.layer_config.connection_id
  ) {
    issues.push("Choose data for the map");
  }

  if (chapter.type === "flyover" && chapter.keyframes.length < 2) {
    issues.push("Add at least two flyover keyframes");
  }

  if (chapter.type === "image" && !chapter.image?.url) {
    issues.push("Choose an image");
  }

  if (chapter.type === "video" && !chapter.video?.video_id) {
    issues.push("Choose a video");
  }

  return { complete: issues.length === 0, issues };
}

export function storyReadiness(story: Story): StoryReadiness {
  const blocking: ReadinessIssue[] = [];
  const advisory: ReadinessIssue[] = [];

  if (!story.title.trim()) {
    blocking.push({ id: "story-title", message: "Add a story title" });
  }
  if (story.chapters.length === 0) {
    blocking.push({
      id: "story-chapters",
      message: "Add at least one chapter",
    });
  }

  for (const chapter of story.chapters) {
    const label = chapter.title.trim() || "Untitled chapter";
    const readiness = chapterReadiness(chapter);
    for (const [index, message] of readiness.issues.entries()) {
      advisory.push({
        id: `${chapter.id}-${index}`,
        chapterId: chapter.id,
        message: `${label}: ${message}`,
      });
    }
  }

  return {
    blocking,
    advisory,
    readyToPublish: blocking.length === 0,
  };
}
