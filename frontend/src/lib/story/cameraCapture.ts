import type { CameraState } from "../layers/types";
import type { Story } from "./types";

/**
 * Merge a camera change into a chapter's map_state, preserving non-camera
 * fields already saved on the chapter (terrain, globe, buildings).
 */
export function captureCameraToChapter(
  story: Story,
  chapterId: string,
  camera: CameraState,
  basemap: string
): Story {
  return {
    ...story,
    chapters: story.chapters.map((ch) =>
      ch.id === chapterId && (ch.type === "scrollytelling" || ch.type === "map")
        ? {
            ...ch,
            map_state: {
              ...ch.map_state,
              center: [camera.longitude, camera.latitude] as [number, number],
              zoom: camera.zoom,
              bearing: camera.bearing,
              pitch: camera.pitch,
              basemap,
            },
          }
        : ch
    ),
  };
}
