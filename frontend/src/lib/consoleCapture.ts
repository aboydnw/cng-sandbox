export interface LogEntry {
  timestamp: string;
  level: "error" | "warn";
  message: string;
}

const MAX_ENTRIES = 50;
const buffer: LogEntry[] = [];

export function getRecentLogs(): LogEntry[] {
  return [...buffer];
}

export function clearLogs(): void {
  buffer.length = 0;
}

export function initConsoleCapture(): () => void {
  const originalError = console.error;
  const originalWarn = console.warn;

  const capture = (level: "error" | "warn", args: unknown[]) => {
    const message = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.stack ?? a.message;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ");
    buffer.push({ timestamp: new Date().toISOString(), level, message });
    if (buffer.length > MAX_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_ENTRIES);
    }
  };

  console.error = (...args: unknown[]) => {
    capture("error", args);
    originalError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    capture("warn", args);
    originalWarn.apply(console, args);
  };

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}
