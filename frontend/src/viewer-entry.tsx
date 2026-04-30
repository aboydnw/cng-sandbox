import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
import { cngRcToStory } from "./lib/story/cngRcAdapter";
import { StoryReaderInner } from "./pages/StoryReaderInner";
import type { CngRcConfig } from "./lib/story/cngRcTypes";
import "./styles.css";

async function loadConfig(): Promise<CngRcConfig> {
  const inlineConfig = (window as { __CNG_RC__?: CngRcConfig }).__CNG_RC__;
  if (inlineConfig) return inlineConfig;

  const resp = await fetch("./cng-rc.json");
  if (!resp.ok) throw new Error(`Failed to fetch cng-rc.json: ${resp.status}`);
  return resp.json() as Promise<CngRcConfig>;
}

async function main() {
  const root = document.getElementById("root")!;
  try {
    const config = await loadConfig();
    const { story, connections } = cngRcToStory(config);

    createRoot(root).render(
      <StrictMode>
        <ChakraProvider value={system}>
          <StoryReaderInner
            story={story}
            datasetMap={new Map()}
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
