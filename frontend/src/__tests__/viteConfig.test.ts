import { afterEach, describe, expect, it } from "vitest";
import { createLogger, createServer, type ViteDevServer } from "vite";

import { sharedConfig } from "../../vite.shared.config";

describe("Vite development config", () => {
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    await server?.close();
  });

  it("starts without deprecated or ignored configuration", async () => {
    const warnings: string[] = [];
    const logger = createLogger("silent");
    logger.warn = (message) => warnings.push(message);
    logger.warnOnce = logger.warn;

    server = await createServer({
      ...sharedConfig,
      configFile: false,
      customLogger: logger,
      server: { middlewareMode: true },
    });

    expect(warnings).toEqual([]);
  });
});
