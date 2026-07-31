import { describe, expect, it } from "vitest";
import {
  CREATE_MAP_INTENT,
  CREATE_STORY_INTENT,
  DATA_ENTRY_ACTIONS,
} from "../creationIntents";

describe("creation intents", () => {
  it("defines two distinct outcome-level actions", () => {
    expect(CREATE_MAP_INTENT).toMatchObject({
      label: "Create map",
      path: "/quick-map",
    });
    expect(CREATE_STORY_INTENT).toMatchObject({
      label: "Create story",
      path: "/story/new",
    });
  });

  it("keeps upload and connection available as data-entry methods", () => {
    expect(DATA_ENTRY_ACTIONS).toEqual({
      upload: "Upload data",
      connect: "Connect data",
    });
  });
});
