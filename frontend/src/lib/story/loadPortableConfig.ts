import type { CngRcConfig } from "./cngRcTypes";

export async function loadPortableConfig(configParam: string): Promise<CngRcConfig> {
  if (configParam.startsWith("base64url:")) {
    const encoded = configParam.slice("base64url:".length);
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
    return parsed as CngRcConfig;
  }

  if (!configParam.startsWith("https://")) {
    throw new Error("Config URL must use https://");
  }

  const response = await fetch(configParam);
  if (!response.ok) {
    throw new Error(`Failed to load config (${response.status})`);
  }
  return (await response.json()) as CngRcConfig;
}
