import type { CngRcConfig } from "./cngRcTypes";

const INLINE_PAYLOAD_MAX_BYTES = 100_000;

function assertSupportedVersion(parsed: unknown): asserts parsed is CngRcConfig {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { version?: unknown }).version !== "1"
  ) {
    throw new Error("Unsupported config version");
  }
}

export async function loadPortableConfig(
  configParam: string
): Promise<CngRcConfig> {
  if (configParam.startsWith("base64url:")) {
    const encoded = configParam.slice("base64url:".length);
    if (encoded.length > INLINE_PAYLOAD_MAX_BYTES) {
      throw new Error("Inline config payload exceeds 100 KB size limit");
    }
    const padded = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    let json: string;
    try {
      json = atob(padded);
    } catch {
      throw new Error("Inline config payload is not valid base64url");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Inline config payload is not valid JSON");
    }
    assertSupportedVersion(parsed);
    return parsed;
  }

  if (!configParam.startsWith("https://")) {
    throw new Error("Config URL must use https://");
  }

  const response = await fetch(configParam);
  if (!response.ok) {
    throw new Error(`Failed to load config (${response.status})`);
  }
  const parsed = (await response.json()) as unknown;
  assertSupportedVersion(parsed);
  return parsed;
}
