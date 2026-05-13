import { workspaceFetch } from "../api";
import { slugifyStoryTitle } from "./slug";

export async function downloadStoryConfig(
  storyId: string,
  storyTitle: string
): Promise<void> {
  const response = await workspaceFetch(
    `/api/stories/${storyId}/export/config`
  );
  if (!response.ok) {
    throw new Error(`Failed to export story config: ${response.status}`);
  }
  const config = await response.json();

  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFor(storyTitle);
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFor(title: string): string {
  return `${slugifyStoryTitle(title)}-cng-rc.json`;
}
