import { describe, expect, it } from "vitest";
import type { JobSnapshot } from "@fileoctopus/ts-api";
import { toolbarJobsDisplay } from "../src/pane/toolbarJobsLabel";

function job(overrides: Partial<JobSnapshot>): JobSnapshot {
  return {
    jobId: "job-1",
    operationKind: "copy",
    status: "running",
    completedItems: 0,
    totalItems: 10,
    completedBytes: 420,
    totalBytes: 1000,
    currentItem: null,
    startedAt: "2026-05-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("toolbarJobsDisplay", () => {
  it("shows a plain Jobs label when nothing is active", () => {
    expect(toolbarJobsDisplay({})).toEqual({
      label: "Jobs",
      ariaLabel: "Jobs",
      activeCount: 0,
    });
  });

  it("shows progress text for a single foreground job", () => {
    const display = toolbarJobsDisplay({
      "job-1": job({}),
    });
    expect(display.label).toBe("Copying 42%");
    expect(display.activeCount).toBe(1);
  });

  it("shows a count when multiple jobs are active", () => {
    const display = toolbarJobsDisplay({
      "job-1": job({ jobId: "job-1" }),
      "job-2": job({ jobId: "job-2", operationKind: "move" }),
    });
    expect(display.label).toBe("Jobs: 2");
    expect(display.activeCount).toBe(2);
  });
});
