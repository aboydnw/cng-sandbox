import { describe, it, expect } from "vitest";
import { classifyCogRenderPath } from "../cogDtype";

describe("classifyCogRenderPath", () => {
  it("returns 'paletted' for uint8 dtype", () => {
    expect(classifyCogRenderPath({ dtype: "uint8", isCategorical: false }))
      .toBe("paletted");
  });

  it("returns 'paletted' for int8 dtype", () => {
    expect(classifyCogRenderPath({ dtype: "int8", isCategorical: false }))
      .toBe("paletted");
  });

  it("returns 'paletted' for categorical integer data", () => {
    expect(classifyCogRenderPath({ dtype: "uint16", isCategorical: true }))
      .toBe("paletted");
  });

  it("returns 'continuous' for float32", () => {
    expect(classifyCogRenderPath({ dtype: "float32", isCategorical: false }))
      .toBe("continuous");
  });

  it("returns 'continuous' for float64", () => {
    expect(classifyCogRenderPath({ dtype: "float64", isCategorical: false }))
      .toBe("continuous");
  });

  it("returns 'continuous' for uint16 non-categorical", () => {
    expect(classifyCogRenderPath({ dtype: "uint16", isCategorical: false }))
      .toBe("continuous");
  });

  it("returns 'continuous' when dtype is null", () => {
    expect(classifyCogRenderPath({ dtype: null, isCategorical: false }))
      .toBe("continuous");
  });

  it("returns 'continuous' when dtype is an unknown string", () => {
    expect(classifyCogRenderPath({ dtype: "complex64", isCategorical: false }))
      .toBe("continuous");
  });
});
