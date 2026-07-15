import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
import { cngRcToStory } from "./lib/story/cngRcAdapter";
import { assertSupportedVersion } from "./lib/story/cngRcVersion";
import { StoryReaderInner } from "./pages/StoryReaderInner";
import type { CngRcConfig } from "./lib/story/cngRcTypes";
import "./styles.css";

async function loadConfig(): Promise<CngRcConfig> {
  const inline = (window as { __CNG_RC__?: unknown }).__CNG_RC__;
  let parsed: unknown;
  if (inline !== undefined) {
    parsed = inline;
  } else {
    const resp = await fetch("./cng-rc.json");
    if (!resp.ok)
      throw new Error(`Failed to fetch cng-rc.json: ${resp.status}`);
    parsed = await resp.json();
  }
  assertSupportedVersion(parsed);
  return parsed;
}

async function main() {
  const root = document.getElementById("root")!;
  try {
    const config = await loadConfig();
    const { story, connections, datasets } = cngRcToStory(config);

    createRoot(root).render(
      <StrictMode>
        <ChakraProvider value={system}>
          <StoryReaderInner
            story={story}
            datasetMap={datasets}
            connectionMap={connections}
            embed
            shared
          />
        </ChakraProvider>
      </StrictMode>
    );
  } catch (err) {
    root.textContent = `Error loading story: ${err instanceof Error ? err.message : String(err)}`;
  }
}

main();
