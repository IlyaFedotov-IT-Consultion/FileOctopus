import type {
  JobSnapshot,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import { Badge, Button, IconButton } from "@fileoctopus/ui";
import { useMemo } from "react";

interface JobMetrics {
  speedLabel: string | null;
  etaLabel: string | null;
}

interface ActivityPanelProps {
  jobs: JobSnapshot[];
  history: OperationHistoryRecordDto[];
  error: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCancel: (jobId: string) => void;
  onRefreshHistory: () => void;
  onClearHistory: () => void;
  jobMetrics: Record<string, JobMetrics>;
}

export function ActivityPanel({
  jobs,
  history,
  error,
  collapsed,
  onToggleCollapsed,
  onCancel,
  onRefreshHistory,
  onClearHistory,
  jobMetrics,
}: ActivityPanelProps) {
  const activeJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  );
  const recentJobs = jobs
    .filter((job) => job.status !== "queued" && job.status !== "running")
    .slice(-5);

  const cards = useMemo(
    () => [...activeJobs, ...recentJobs],
    [activeJobs, recentJobs],
  );

  if (collapsed) {
    return (
      <aside
        className="fo-activity fo-activity-rail fo-activity-collapsed"
        aria-label="Job activity"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleCollapsed}
        >
          Activity
          {activeJobs.length > 0 ? (
            <Badge tone="accent">{activeJobs.length}</Badge>
          ) : null}
        </Button>
      </aside>
    );
  }

  return (
    <aside className="fo-activity fo-activity-rail" aria-label="Job activity">
      <header className="fo-activity-header">
        <div>
          <h2>
            Jobs & Activity
            {activeJobs.length > 0 ? (
              <Badge tone="accent">{activeJobs.length}</Badge>
            ) : null}
          </h2>
          <p>Operations and history</p>
        </div>
        <IconButton
          label="Collapse activity panel"
          size="sm"
          onClick={onToggleCollapsed}
        >
          -
        </IconButton>
      </header>
      {error ? <div className="fo-operation-error">{error}</div> : null}
      <div
        className="fo-activity-tabs"
        role="tablist"
        aria-label="Activity views"
      >
        <span className="fo-activity-tab-active">Activity</span>
        <span>History</span>
      </div>
      <div className="fo-activity-cards">
        {cards.length === 0 ? (
          <div className="fo-empty-inline">No active jobs</div>
        ) : (
          cards.map((job) => {
            const jobId = jobIdValue(job.jobId);
            const percent = progressPercent(job);
            const metrics = jobMetrics[jobId];
            const tone =
              job.status === "failed"
                ? "failed"
                : job.status === "completed"
                  ? "completed"
                  : job.status === "queued"
                    ? "queued"
                    : "running";

            return (
              <article
                className={`fo-job-card fo-job-card-${tone}`}
                key={jobId}
              >
                <div className="fo-job-card-title">
                  <span
                    className="fo-job-operation"
                    data-icon={operationIcon(job.operationKind)}
                  >
                    {job.operationKind} {job.status}
                  </span>
                  <span>{percent}%</span>
                </div>
                <p className="fo-job-card-status">{job.status}</p>
                <div className="fo-job-card-bar">
                  <div style={{ width: `${percent}%` }} />
                </div>
                <p className="fo-job-card-meta">
                  {job.completedItems}/{job.totalItems} items
                  {metrics?.speedLabel ? ` - ${metrics.speedLabel}` : ""}
                  {metrics?.etaLabel ? ` - ${metrics.etaLabel}` : ""}
                </p>
                {job.status === "running" || job.status === "queued" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(jobId)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      <section className="fo-history" aria-label="Operation history">
        <header>
          <strong>History</strong>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefreshHistory}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
            >
              Clear
            </Button>
          </div>
        </header>
        {history.length === 0 ? (
          <div className="fo-empty-inline">No recent operations</div>
        ) : (
          history.slice(0, 8).map((item) => (
            <div className="fo-history-row" key={item.jobId}>
              <span>{item.operationKind}</span>
              <span>{item.status}</span>
              <span>{item.representativeSourcePath ?? ""}</span>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return typeof jobId === "string" ? jobId : String(jobId.value ?? "");
}

function progressPercent(job: JobSnapshot): number {
  if (job.totalBytes && job.totalBytes > 0) {
    return Math.min(
      100,
      Math.round((job.completedBytes / job.totalBytes) * 100),
    );
  }
  if (job.totalItems > 0) {
    return Math.min(
      100,
      Math.round((job.completedItems / job.totalItems) * 100),
    );
  }
  return 0;
}

function operationIcon(operationKind: string): string {
  switch (operationKind) {
    case "copy":
      return "CP";
    case "move":
      return "MV";
    case "trash":
    case "delete":
      return "TR";
    case "rename":
      return "RN";
    default:
      return "OP";
  }
}
