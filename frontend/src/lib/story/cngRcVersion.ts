import type { CngRcConfig } from "./cngRcTypes";

export function assertSupportedVersion(
  parsed: unknown
): asserts parsed is CngRcConfig {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { version?: unknown }).version !== "1"
  ) {
    throw new Error("Unsupported config version");
  }
}
