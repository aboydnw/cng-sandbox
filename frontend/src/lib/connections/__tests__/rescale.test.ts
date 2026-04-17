import { describe, it, expect } from "vitest";
import { parseRescaleString } from "../rescale";

describe("parseRescaleString", () => {
  it("parses a well-formed min,max string", () => {
    expect(parseRescaleString("0,255")).toEqual({ min: 0, max: 255 });
  });

  it("parses negative and decimal values", () => {
    expect(parseRescaleString("-10.5,42.25")).toEqual({ min: -10.5, max: 42.25 });
  });

  it("trims whitespace", () => {
    expect(parseRescaleString("  0 , 1 ")).toEqual({ min: 0, max: 1 });
  });

  it("returns null for null input", () => {
    expect(parseRescaleString(null)).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseRescaleString("not,a,rescale")).toBeNull();
    expect(parseRescaleString("abc")).toBeNull();
    expect(parseRescaleString("")).toBeNull();
    expect(parseRescaleString("1")).toBeNull();
    expect(parseRescaleString("NaN,1")).toBeNull();
  });

  it("returns null when min >= max", () => {
    expect(parseRescaleString("5,5")).toBeNull();
    expect(parseRescaleString("10,5")).toBeNull();
  });
});
