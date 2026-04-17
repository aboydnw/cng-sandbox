export interface LutCategory {
  value: number;
  color: string;
  label: string;
}

export function buildCategoricalLut(categories: LutCategory[]): Uint8Array {
  const lut = new Uint8Array(256 * 4); // all zeros → transparent
  for (const cat of categories) {
    if (!Number.isInteger(cat.value) || cat.value < 0 || cat.value > 255)
      continue;
    const hex = cat.color.replace("#", "");
    if (hex.length !== 6) continue;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b))
      continue;
    const i = cat.value * 4;
    lut[i] = r;
    lut[i + 1] = g;
    lut[i + 2] = b;
    lut[i + 3] = 255;
  }
  return lut;
}
