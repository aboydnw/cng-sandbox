export const DEFAULT_SIZE_THRESHOLD = 50 * 1024 * 1024;
export const DEFAULT_FEATURE_THRESHOLD = 500_000;

export interface PickRenderPathInput {
  sizeBytes: number | null;
  featureCount: number | null;
}

export interface PickRenderPathOptions {
  sizeThreshold?: number;
  featureThreshold?: number;
}

export function pickRenderPath(
  { sizeBytes, featureCount }: PickRenderPathInput,
  options: PickRenderPathOptions = {}
): "client" | "server" {
  const sizeThreshold = options.sizeThreshold ?? DEFAULT_SIZE_THRESHOLD;
  const featureThreshold = options.featureThreshold ?? DEFAULT_FEATURE_THRESHOLD;
  if (sizeBytes == null) return "server";
  if (sizeBytes > sizeThreshold) return "server";
  if (featureCount != null && featureCount > featureThreshold) return "server";
  return "client";
}
