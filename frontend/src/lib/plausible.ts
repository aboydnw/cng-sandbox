type PlausibleFn = ((...args: unknown[]) => void) & {
  q?: unknown[];
  o?: Record<string, unknown>;
  init?: (options?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

export function initPlausible(): void {
  const stub: PlausibleFn =
    window.plausible ||
    function (...args: unknown[]) {
      (stub.q = stub.q || []).push(args);
    };
  stub.init =
    stub.init ||
    function (options?: Record<string, unknown>) {
      stub.o = options || {};
    };
  window.plausible = stub;
  stub.init();
}
