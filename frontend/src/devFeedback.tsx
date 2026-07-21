import { createRoot } from "react-dom/client";
import { RiffrecProvider, RiffrecRecorder } from "riffrec";

/**
 * Mounts the riffrec feedback recorder into its own React root.
 *
 * Kept out of the main app tree (and out of production builds) on purpose:
 * it is a local dev tool for capturing product-feedback sessions, not a
 * shipped feature. The recorder captures screen, clicks, navigation, network,
 * and console globally via browser APIs, so it does not need to wrap <App />.
 *
 * The caller guards this behind `import.meta.env.DEV`, so Vite dead-code
 * eliminates the whole branch — including this module — from the production
 * `vite build` that Caddy serves. The recorder only exists on the local Vite
 * dev server.
 */
export function mountDevFeedback() {
  const container = document.createElement("div");
  container.id = "riffrec-root";
  document.body.appendChild(container);

  createRoot(container).render(
    <RiffrecProvider>
      <RiffrecRecorder />
    </RiffrecProvider>
  );
}
