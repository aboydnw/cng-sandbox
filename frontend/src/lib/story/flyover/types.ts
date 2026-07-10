export interface FlyoverKeyframe {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  /** Markdown; a card fades in/out around this keyframe's progress position. */
  caption?: string;
}

export interface CameraPose {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}
