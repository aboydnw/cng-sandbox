export type CogRenderPath = "paletted" | "continuous";

interface ClassifyInput {
  dtype: string | null;
  isCategorical: boolean;
}

const PALETTED_DTYPES = new Set(["uint8", "int8"]);
const INTEGER_DTYPES = new Set([
  "uint8",
  "int8",
  "uint16",
  "int16",
  "uint32",
  "int32",
]);

export function classifyCogRenderPath({
  dtype,
  isCategorical,
}: ClassifyInput): CogRenderPath {
  if (dtype && PALETTED_DTYPES.has(dtype)) return "paletted";
  if (isCategorical && dtype && INTEGER_DTYPES.has(dtype)) return "paletted";
  return "continuous";
}
