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
  const normalizedDtype = dtype?.trim().toLowerCase() ?? null;
  if (normalizedDtype && PALETTED_DTYPES.has(normalizedDtype))
    return "paletted";
  if (isCategorical && normalizedDtype && INTEGER_DTYPES.has(normalizedDtype))
    return "paletted";
  return "continuous";
}
