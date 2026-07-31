export interface CreationIntent {
  label: string;
  path: string;
  description: string;
}

export const CREATE_MAP_INTENT = {
  label: "Create map",
  path: "/quick-map",
  description:
    "Upload a file, connect cloud data, or use data already in your workspace.",
} as const satisfies CreationIntent;

export const CREATE_STORY_INTENT = {
  label: "Create story",
  path: "/story/new",
  description:
    "Start writing, then add existing data, upload a file, or connect a cloud source when you need it.",
} as const satisfies CreationIntent;

export const DATA_ENTRY_ACTIONS = {
  upload: "Upload data",
  connect: "Connect data",
} as const;
