export type Rgba = [number, number, number, number];

// 256-step LUTs. Real implementation should re-use the same colormap tables
// the live reader uses (see `frontend/src/lib/maptool/colormaps.ts` if present)
// so exports look identical to in-app rendering.
export const COLORMAPS: Record<string, Rgba[]> = {};

function registerLinear(name: string, stops: Rgba[]): void {
  const lut: Rgba[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const segCount = stops.length - 1;
    const segIdx = Math.min(segCount - 1, Math.floor(t * segCount));
    const segT = t * segCount - segIdx;
    const a = stops[segIdx];
    const b = stops[segIdx + 1];
    lut.push([
      Math.round(a[0] + (b[0] - a[0]) * segT),
      Math.round(a[1] + (b[1] - a[1]) * segT),
      Math.round(a[2] + (b[2] - a[2]) * segT),
      Math.round(a[3] + (b[3] - a[3]) * segT),
    ]);
  }
  COLORMAPS[name] = lut;
}

registerLinear("viridis", [
  [68, 1, 84, 255],
  [59, 82, 139, 255],
  [33, 145, 140, 255],
  [94, 201, 98, 255],
  [253, 231, 37, 255],
]);
registerLinear("magma", [
  [0, 0, 4, 255],
  [80, 18, 123, 255],
  [183, 55, 121, 255],
  [251, 136, 97, 255],
  [252, 253, 191, 255],
]);
registerLinear("plasma", [
  [13, 8, 135, 255],
  [126, 3, 168, 255],
  [203, 70, 121, 255],
  [248, 149, 64, 255],
  [240, 249, 33, 255],
]);
registerLinear("blues", [
  [247, 251, 255, 255],
  [33, 113, 181, 255],
  [8, 48, 107, 255],
]);
registerLinear("reds", [
  [255, 245, 240, 255],
  [222, 45, 38, 255],
  [103, 0, 13, 255],
]);
registerLinear("greys", [
  [255, 255, 255, 255],
  [120, 120, 120, 255],
  [0, 0, 0, 255],
]);
