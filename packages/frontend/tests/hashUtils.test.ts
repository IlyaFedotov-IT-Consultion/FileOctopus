import { describe, it, expect } from "vitest";
import { formatHash, type HashState } from "../src/pane/hashUtils";

describe("formatHash", () => {
  it("shows dash for undefined hash", () => {
    expect(formatHash(undefined)).toBe("—");
  });

  it("shows dash for empty string", () => {
    expect(formatHash("")).toBe("—");
  });

  it("shows first 16 chars of SHA-256", () => {
    const full =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(formatHash(full)).toBe("e3b0c44298fc1c14");
  });

  it("shows computing… for loading state", () => {
    expect(formatHash("computing")).toBe("…");
  });

  it("shows error indicator for error state", () => {
    expect(formatHash("error")).toBe("⚠");
  });
});

describe("HashState", () => {
  it("type accepts all variants", () => {
    const states: HashState[] = [
      undefined,
      "computing",
      "error",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ];
    expect(states).toHaveLength(4);
  });
});
