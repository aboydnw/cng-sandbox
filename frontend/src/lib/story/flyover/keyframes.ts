import type { CameraState } from "../../layers/types";
import type { FlyoverKeyframe } from "./types";

/** Record the live editor camera as a pose keyframe. */
export function captureKeyframe(camera: CameraState): FlyoverKeyframe {
  return {
    center: [camera.longitude, camera.latitude],
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
  };
}

export function addKeyframe(
  list: FlyoverKeyframe[],
  kf: FlyoverKeyframe
): FlyoverKeyframe[] {
  return [...list, kf];
}

export function removeKeyframe(
  list: FlyoverKeyframe[],
  index: number
): FlyoverKeyframe[] {
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

export function moveKeyframe(
  list: FlyoverKeyframe[],
  from: number,
  to: number
): FlyoverKeyframe[] {
  if (
    from < 0 ||
    from >= list.length ||
    to < 0 ||
    to >= list.length ||
    from === to
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Replace a keyframe's pose from the live camera, preserving its caption. */
export function recaptureKeyframe(
  list: FlyoverKeyframe[],
  index: number,
  camera: CameraState
): FlyoverKeyframe[] {
  if (index < 0 || index >= list.length) return list;
  const caption = list[index].caption;
  return list.map((k, i) =>
    i === index
      ? { ...captureKeyframe(camera), ...(caption ? { caption } : {}) }
      : k
  );
}

export function setKeyframeCaption(
  list: FlyoverKeyframe[],
  index: number,
  caption: string
): FlyoverKeyframe[] {
  if (index < 0 || index >= list.length) return list;
  return list.map((k, i) => {
    if (i !== index) return k;
    if (caption) return { ...k, caption };
    const next = { ...k };
    delete next.caption;
    return next;
  });
}
