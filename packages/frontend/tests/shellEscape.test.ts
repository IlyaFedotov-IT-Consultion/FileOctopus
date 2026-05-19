import { describe, expect, it } from "vitest";
import { shellEscapePosixPath } from "../src/terminal/shellEscape";

describe("shellEscapePosixPath", () => {
  it("wraps paths in single quotes", () => {
    expect(shellEscapePosixPath("/tmp/demo")).toBe("'/tmp/demo'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscapePosixPath("/tmp/o'brien")).toBe("'/tmp/o'\\''brien'");
  });

  it("returns empty quoted path for empty input", () => {
    expect(shellEscapePosixPath("")).toBe("''");
  });
});
