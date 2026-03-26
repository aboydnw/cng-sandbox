import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initConsoleCapture,
  getRecentLogs,
  clearLogs,
} from "../consoleCapture";

let cleanup: (() => void) | undefined;

beforeEach(() => {
  cleanup = initConsoleCapture();
});

afterEach(() => {
  cleanup?.();
  clearLogs();
});

describe("consoleCapture", () => {
  it("captures console.error calls", () => {
    console.error("test error");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].message).toContain("test error");
  });

  it("captures console.warn calls", () => {
    console.warn("test warning");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("warn");
  });

  it("does not capture console.log", () => {
    console.log("should be ignored");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(0);
  });

  it("limits buffer to 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      console.error(`error ${i}`);
    }
    const logs = getRecentLogs();
    expect(logs).toHaveLength(50);
    expect(logs[0].message).toContain("error 10");
  });

  it("includes timestamps", () => {
    console.error("timed");
    const logs = getRecentLogs();
    expect(logs[0].timestamp).toBeDefined();
    expect(typeof logs[0].timestamp).toBe("string");
  });

  it("clearLogs empties the buffer", () => {
    console.error("something");
    clearLogs();
    expect(getRecentLogs()).toHaveLength(0);
  });
});
