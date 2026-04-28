import { workspaceFetch } from "../api";

export interface UploadedImageAsset {
  asset_id: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  mime: string;
  size_bytes: number;
}

export async function uploadImageAsset(
  file: File,
  storyId?: string
): Promise<UploadedImageAsset> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "image");
  if (storyId) form.append("story_id", storyId);

  const resp = await workspaceFetch("/api/story-assets", {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`upload failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

export async function deleteStoryAsset(assetId: string): Promise<void> {
  const resp = await workspaceFetch(`/api/story-assets/${assetId}`, {
    method: "DELETE",
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`delete failed: ${resp.status}`);
  }
}
