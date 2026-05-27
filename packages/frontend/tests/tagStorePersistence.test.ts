import { describe, it, expect, beforeEach } from "vitest";
import {
  type FileTag,
  loadTags,
  saveTags,
  addTagToEntry,
  removeTagFromEntry,
} from "../src/utils/tagStore";

beforeEach(() => {
  localStorage.clear();
});

describe("loadTags", () => {
  it("returns empty array when nothing stored", () => {
    expect(loadTags()).toEqual([]);
  });

  it("returns parsed tags from localStorage", () => {
    const tags: FileTag[] = [
      { uri: "local:///home/user/a.txt", color: "red", label: "Urgent" },
      { uri: "local:///home/user/b.txt", color: "blue", label: "Work" },
    ];
    localStorage.setItem("fo-file-tags", JSON.stringify(tags));
    expect(loadTags()).toEqual(tags);
  });

  it("returns empty array on invalid JSON", () => {
    localStorage.setItem("fo-file-tags", "not json");
    expect(loadTags()).toEqual([]);
  });

  it("filters out entries with invalid color", () => {
    const raw = [
      { uri: "local:///a.txt", color: "red", label: "Valid" },
      { uri: "local:///b.txt", color: "burgundy", label: "Invalid" },
    ];
    localStorage.setItem("fo-file-tags", JSON.stringify(raw));
    const result = loadTags();
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("red");
  });

  it("filters out entries missing required fields", () => {
    const raw = [
      { uri: "local:///a.txt", color: "red", label: "Valid" },
      { uri: "local:///b.txt", color: "blue" },
      { color: "green", label: "Missing URI" },
      42,
      null,
    ];
    localStorage.setItem("fo-file-tags", JSON.stringify(raw));
    const result = loadTags();
    expect(result).toHaveLength(1);
    expect(result[0].uri).toBe("local:///a.txt");
  });
});

describe("saveTags + loadTags round-trip", () => {
  it("round-trips empty array", () => {
    saveTags([]);
    expect(loadTags()).toEqual([]);
  });

  it("round-trips populated array", () => {
    const tags: FileTag[] = [
      { uri: "local:///x.txt", color: "green", label: "Done" },
      { uri: "local:///y.txt", color: "orange", label: "Pending" },
    ];
    saveTags(tags);
    expect(loadTags()).toEqual(tags);
  });

  it("preserves add + remove + reload", () => {
    const tag1: FileTag = { uri: "local:///a.txt", color: "red", label: "A" };
    const tag2: FileTag = { uri: "local:///b.txt", color: "blue", label: "B" };

    let tags: FileTag[] = [];
    tags = addTagToEntry(tags, tag1);
    tags = addTagToEntry(tags, tag2);
    saveTags(tags);

    let loaded = loadTags();
    expect(loaded).toHaveLength(2);

    tags = removeTagFromEntry(tags, tag1.uri, tag1.color);
    saveTags(tags);

    loaded = loadTags();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].color).toBe("blue");
  });
});
