import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendSrc = join(process.cwd(), "src");

function sourceFiles(path = frontendSrc): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe("frontend architecture boundaries", () => {
  it("does not import Tauri APIs from the frontend package", () => {
    const offenders = sourceFiles().filter((file) =>
      readFileSync(file, "utf8").includes("@tauri-apps/"),
    );

    expect(offenders).toEqual([]);
  });
});
