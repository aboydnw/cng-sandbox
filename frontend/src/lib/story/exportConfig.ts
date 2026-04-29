export async function downloadStoryConfig(
  storyId: string,
  storyTitle: string
): Promise<void> {
  const response = await fetch(`/api/stories/${storyId}/export/config`);
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
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "story";
  return `${slug}-cng-rc.json`;
}
