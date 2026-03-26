import { describe, it, expect } from "vitest";
import {
  detectCadence,
  findGaps,
  isSubDaily,
  formatTimestepLabel,
} from "./temporal";

describe("detectCadence", () => {
  it("detects annual cadence", () => {
    const dts = [
      "2015-01-01T00:00:00Z",
      "2016-01-01T00:00:00Z",
      "2017-01-01T00:00:00Z",
    ];
    expect(detectCadence(dts)).toBe("annual");
  });

  it("detects monthly cadence", () => {
    const dts = [
      "2020-01-01T00:00:00Z",
      "2020-02-01T00:00:00Z",
      "2020-03-01T00:00:00Z",
    ];
    expect(detectCadence(dts)).toBe("monthly");
  });

  it("returns irregular for mixed intervals", () => {
    const dts = [
      "2020-01-01T00:00:00Z",
      "2020-03-15T00:00:00Z",
      "2020-11-20T00:00:00Z",
    ];
    expect(detectCadence(dts)).toBe("irregular");
  });
});

describe("findGaps", () => {
  it("finds missing years in annual data", () => {
    const dts = [
      "2015-01-01T00:00:00Z",
      "2017-01-01T00:00:00Z",
      "2019-01-01T00:00:00Z",
    ];
    const gaps = findGaps(dts);
    expect(gaps).toEqual(["2016-01-01T00:00:00Z", "2018-01-01T00:00:00Z"]);
  });

  it("returns empty for complete data", () => {
    const dts = [
      "2015-01-01T00:00:00Z",
      "2016-01-01T00:00:00Z",
      "2017-01-01T00:00:00Z",
    ];
    expect(findGaps(dts)).toEqual([]);
  });

  it("returns empty for irregular data", () => {
    const dts = [
      "2020-01-01T00:00:00Z",
      "2020-03-15T00:00:00Z",
      "2020-11-20T00:00:00Z",
    ];
    expect(findGaps(dts)).toEqual([]);
  });

  it("finds missing months in monthly data", () => {
    const dts = [
      "2020-01-01T00:00:00Z",
      "2020-03-01T00:00:00Z",
      "2020-04-01T00:00:00Z",
    ];
    const gaps = findGaps(dts);
    expect(gaps).toEqual(["2020-02-01T00:00:00Z"]);
  });
});

describe("isSubDaily", () => {
  it("returns true for hourly data", () => {
    const dts = [
      "2021-07-15T00:00:00Z",
      "2021-07-15T01:00:00Z",
      "2021-07-15T02:00:00Z",
    ];
    expect(isSubDaily(dts)).toBe(true);
  });

  it("returns false for annual data", () => {
    const dts = ["2015-01-01T00:00:00Z", "2016-01-01T00:00:00Z"];
    expect(isSubDaily(dts)).toBe(false);
  });
});

describe("formatTimestepLabel", () => {
  it("formats annual as year only", () => {
    expect(formatTimestepLabel("2018-01-01T00:00:00Z", "annual")).toBe("2018");
  });

  it("formats monthly as Mon YYYY", () => {
    expect(formatTimestepLabel("2020-07-01T00:00:00Z", "monthly")).toBe(
      "Jul 2020"
    );
  });
});
