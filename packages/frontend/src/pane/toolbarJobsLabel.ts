import type { JobSnapshot } from "@fileoctopus/ts-api";
import { operationVerb, progressPercent } from "../jobs/jobCardUtils";

export interface ToolbarJobsDisplay {
  label: string;
  ariaLabel: string;
  activeCount: number;
}

function activeJobs(jobs: Record<string, JobSnapshot>): JobSnapshot[] {
  return Object.values(jobs).filter(
    (job) => job.status === "queued" || job.status === "running",
  );
}

export function toolbarJobsDisplay(
  jobs: Record<string, JobSnapshot>,
): ToolbarJobsDisplay {
  const running = activeJobs(jobs);
  if (running.length === 0) {
    return {
      label: "Jobs",
      ariaLabel: "Jobs",
      activeCount: 0,
    };
  }

  if (running.length > 1) {
    return {
      label: `Jobs: ${running.length}`,
      ariaLabel: `${running.length} active jobs`,
      activeCount: running.length,
    };
  }

  const job = running[0];
  const percent = progressPercent(job);
  const verb = operationVerb(job.operationKind);
  const label = percent > 0 ? `${verb} ${percent}%` : verb;

  return {
    label,
    ariaLabel: `${verb}, ${percent} percent complete`,
    activeCount: 1,
  };
}
