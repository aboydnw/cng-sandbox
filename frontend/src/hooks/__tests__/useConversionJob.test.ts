import { describe, it, expect } from "vitest";
import { extractErrorMessage, stripPydanticPrefix } from "../useConversionJob";

describe("stripPydanticPrefix", () => {
  it("strips 'Value error, ' prefix", () => {
    expect(
      stripPydanticPrefix("Value error, Only http and https URLs are supported")
    ).toBe("Only http and https URLs are supported");
  });

  it("leaves messages without prefix unchanged", () => {
    expect(stripPydanticPrefix("File not found")).toBe("File not found");
  });
});

describe("extractErrorMessage", () => {
  it("extracts detail string", () => {
    expect(extractErrorMessage({ detail: "Upload failed" }, "fallback")).toBe(
      "Upload failed"
    );
  });

  it("extracts message string", () => {
    expect(extractErrorMessage({ message: "Server error" }, "fallback")).toBe(
      "Server error"
    );
  });

  it("extracts error string", () => {
    expect(extractErrorMessage({ error: "Bad request" }, "fallback")).toBe(
      "Bad request"
    );
  });

  it("returns fallback when no known keys", () => {
    expect(extractErrorMessage({ foo: "bar" }, "fallback")).toBe("fallback");
  });

  it("handles array of pydantic validation errors", () => {
    const body = {
      detail: [
        { msg: "Value error, Only http URLs supported", type: "value_error" },
        { msg: "Value error, URL too long", type: "value_error" },
      ],
    };
    const result = extractErrorMessage(body, "fallback");
    expect(result).toBe("Only http URLs supported; URL too long");
  });

  it("prefers detail over message over error", () => {
    expect(
      extractErrorMessage({ detail: "d", message: "m", error: "e" }, "f")
    ).toBe("d");
  });
});
