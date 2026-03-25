import { describe, it, expect, vi, beforeEach } from "vitest";

const STORAGE_KEY = "myWorkspaceId";

function generateWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

describe("generateWorkspaceId", () => {
  it("returns an 8-char alphanumeric string", () => {
    const id = generateWorkspaceId();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe("workspace localStorage logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves workspace ID", () => {
    const id = generateWorkspaceId();
    localStorage.setItem(STORAGE_KEY, id);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it("returns null when no workspace stored", () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
