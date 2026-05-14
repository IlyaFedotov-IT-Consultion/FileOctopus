use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use fs_core::file_ops::{execute_file_operation, plan_file_operation, FileOperationEventSink};
use fs_core::LocalFsProvider;
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobSnapshot, JobStartedEvent, JobStatus,
};
use rusqlite::{params, Connection};
use thiserror::Error;
use vfs::{FileOperationError, FileOperationPlan, FileOperationRequest, VfsRegistry};

#[derive(Debug, Error)]
pub enum AppCoreError {
    #[error("failed to initialize telemetry: {0}")]
    Telemetry(String),
    #[error("failed to initialize VFS: {0}")]
    Vfs(String),
    #[error("failed to initialize operation history: {0}")]
    History(String),
}

#[derive(Clone)]
pub struct AppState {
    vfs: Arc<VfsRegistry>,
    operations: Arc<OperationRuntime>,
}

impl AppState {
    pub fn vfs(&self) -> Arc<VfsRegistry> {
        self.vfs.clone()
    }

    pub fn operations(&self) -> Arc<OperationRuntime> {
        self.operations.clone()
    }
}

pub struct AppCore;

impl AppCore {
    pub fn boot() -> Result<Arc<AppState>, AppCoreError> {
        Self::boot_with_history_path(default_history_path())
    }

    pub fn boot_with_history_path(history_path: PathBuf) -> Result<Arc<AppState>, AppCoreError> {
        telemetry::init().map_err(|error| AppCoreError::Telemetry(error.to_string()))?;

        let vfs = Arc::new(VfsRegistry::new());

        vfs.register(Arc::new(LocalFsProvider::new()))
            .map_err(|error| AppCoreError::Vfs(error.to_string()))?;
        let history = OperationHistoryRepository::new(history_path)
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let operations = Arc::new(OperationRuntime::new(history));

        telemetry::info("FileOctopus app core booted");

        Ok(Arc::new(AppState { vfs, operations }))
    }
}

#[derive(Clone)]
pub struct OperationRuntime {
    jobs: Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    history: OperationHistoryRepository,
}

impl OperationRuntime {
    pub fn new(history: OperationHistoryRepository) -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            history,
        }
    }

    pub fn plan(
        &self,
        request: FileOperationRequest,
    ) -> Result<FileOperationPlan, FileOperationError> {
        let kind = request.kind;
        let result = plan_file_operation(request);

        if let Err(error) = &result {
            telemetry::error(&format!(
                "operation planning failed kind={kind:?} code={}",
                error.code()
            ));
        }

        result
    }

    pub fn start(
        &self,
        plan: FileOperationPlan,
        sink: Arc<FileOperationEventSink>,
    ) -> Result<JobSnapshot, FileOperationError> {
        let job_id = JobId::new(uuid::Uuid::new_v4().to_string());
        let now = Utc::now();
        let snapshot = JobSnapshot {
            job_id: job_id.clone(),
            operation_kind: plan.kind,
            status: JobStatus::Queued,
            current_item: None,
            completed_items: 0,
            total_items: plan.total_items,
            completed_bytes: 0,
            total_bytes: plan.total_bytes,
            error_code: None,
            message: None,
            started_at: now,
            updated_at: now,
        };
        let token = CancellationToken::new();
        let state = JobRuntimeState {
            snapshot: snapshot.clone(),
            cancel: token.clone(),
        };

        self.jobs
            .lock()
            .map_err(|_| FileOperationError::Internal {
                message: "job registry lock poisoned".to_string(),
            })?
            .insert(job_id.as_str().to_string(), state);
        self.history.insert_started(&plan, &snapshot);
        telemetry::info(&format!(
            "operation job started job_id={} kind={:?} source_count={} total_items={}",
            job_id.as_str(),
            plan.kind,
            plan.sources.len(),
            plan.total_items
        ));

        let jobs = self.jobs.clone();
        let history = self.history.clone();
        let sink_for_thread = sink.clone();
        let thread_job_id = job_id.clone();
        let started = JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: plan.kind,
            total_items: plan.total_items,
            total_bytes: plan.total_bytes,
            started_at: now,
        });

        sink(started);
        update_snapshot_status(&jobs, &job_id, JobStatus::Running, None, None);

        std::thread::spawn(move || {
            let progress_jobs = jobs.clone();
            let progress_sink = move |event: JobEvent| {
                if let JobEvent::Progress(progress) = &event {
                    update_snapshot_progress(&progress_jobs, progress);
                }

                sink_for_thread(event);
            };
            let progress_sink = Arc::new(progress_sink) as Arc<FileOperationEventSink>;
            let result = execute_file_operation(&plan, &thread_job_id, &token, &*progress_sink);

            match result {
                Ok(()) => {
                    let completed_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job completed job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Completed, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Completed, None);
                    progress_sink(JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        completed_items: plan.total_items,
                        completed_bytes: plan.total_bytes.unwrap_or(0),
                        completed_at,
                    }));
                }
                Err(FileOperationError::Cancelled { .. }) => {
                    let cancelled_at = Utc::now();
                    telemetry::info(&format!(
                        "operation job cancelled job_id={} kind={:?}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));
                    update_snapshot_status(&jobs, &thread_job_id, JobStatus::Cancelled, None, None);
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Cancelled, None);
                    progress_sink(JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        cancelled_at,
                    }));
                }
                Err(error) => {
                    let failed_at = Utc::now();
                    let code = error.code().to_string();
                    let message = error.user_message();
                    telemetry::error(&format!(
                        "operation job failed job_id={} kind={:?} code={code}",
                        thread_job_id.as_str(),
                        plan.kind
                    ));

                    update_snapshot_status(
                        &jobs,
                        &thread_job_id,
                        JobStatus::Failed,
                        Some(code.clone()),
                        Some(message.clone()),
                    );
                    history.update_terminal(thread_job_id.as_str(), JobStatus::Failed, Some(&code));
                    progress_sink(JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: plan.kind,
                        error_code: code,
                        message,
                        failed_at,
                    }));
                }
            }
        });

        Ok(snapshot)
    }

    pub fn cancel(&self, job_id: &str) -> Result<JobSnapshot, FileOperationError> {
        let jobs = self.jobs.lock().map_err(|_| FileOperationError::Internal {
            message: "job registry lock poisoned".to_string(),
        })?;
        let state = jobs
            .get(job_id)
            .ok_or_else(|| FileOperationError::NotFound {
                uri: job_id.to_string(),
            })?;

        state.cancel.cancel();
        telemetry::info(&format!(
            "operation job cancellation requested job_id={job_id}"
        ));

        Ok(state.snapshot.clone())
    }

    pub fn status(&self, job_id: &str) -> Result<JobSnapshot, FileOperationError> {
        let jobs = self.jobs.lock().map_err(|_| FileOperationError::Internal {
            message: "job registry lock poisoned".to_string(),
        })?;

        jobs.get(job_id)
            .map(|state| state.snapshot.clone())
            .ok_or_else(|| FileOperationError::NotFound {
                uri: job_id.to_string(),
            })
    }

    pub fn recent_history(&self, limit: u32) -> Vec<OperationHistoryRecord> {
        self.history.list_recent(limit).unwrap_or_default()
    }
}

#[derive(Clone)]
struct JobRuntimeState {
    snapshot: JobSnapshot,
    cancel: CancellationToken,
}

#[derive(Clone)]
pub struct OperationHistoryRepository {
    path: Arc<PathBuf>,
}

impl OperationHistoryRepository {
    pub fn new(path: PathBuf) -> rusqlite::Result<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let repository = Self {
            path: Arc::new(path),
        };

        repository.migrate()?;

        Ok(repository)
    }

    pub fn migrate(&self) -> rusqlite::Result<()> {
        let connection = self.connect()?;

        connection.execute(
            "create table if not exists operation_history (
                job_id text primary key,
                operation_kind text not null,
                source_count integer not null,
                representative_source_path text,
                destination_path text,
                status text not null,
                started_at text not null,
                completed_at text,
                error_code text
            )",
            [],
        )?;

        Ok(())
    }

    fn insert_started(&self, plan: &FileOperationPlan, snapshot: &JobSnapshot) {
        if let Err(error) = self.try_insert_started(plan, snapshot) {
            telemetry::error(&format!("failed to persist operation start: {error}"));
        }
    }

    fn try_insert_started(
        &self,
        plan: &FileOperationPlan,
        snapshot: &JobSnapshot,
    ) -> rusqlite::Result<()> {
        let connection = self.connect()?;

        connection.execute(
            "insert or replace into operation_history (
                job_id, operation_kind, source_count, representative_source_path,
                destination_path, status, started_at, completed_at, error_code
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, null, null)",
            params![
                snapshot.job_id.as_str(),
                format!("{:?}", plan.kind),
                plan.sources.len() as i64,
                plan.sources.first().map(|uri| uri.display_path()),
                plan.destination.as_ref().map(|uri| uri.display_path()),
                "running",
                snapshot.started_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    fn update_terminal(&self, job_id: &str, status: JobStatus, error_code: Option<&str>) {
        if let Err(error) = self.try_update_terminal(job_id, status, error_code) {
            telemetry::error(&format!(
                "failed to persist operation terminal state: {error}"
            ));
        }
    }

    fn try_update_terminal(
        &self,
        job_id: &str,
        status: JobStatus,
        error_code: Option<&str>,
    ) -> rusqlite::Result<()> {
        let connection = self.connect()?;

        connection.execute(
            "update operation_history
             set status = ?2, completed_at = ?3, error_code = ?4
             where job_id = ?1",
            params![
                job_id,
                status_string(status),
                Utc::now().to_rfc3339(),
                error_code,
            ],
        )?;

        Ok(())
    }

    pub fn list_recent(&self, limit: u32) -> rusqlite::Result<Vec<OperationHistoryRecord>> {
        let connection = self.connect()?;
        let mut statement = connection.prepare(
            "select job_id, operation_kind, source_count, representative_source_path,
                    destination_path, status, started_at, completed_at, error_code
             from operation_history
             order by started_at desc
             limit ?1",
        )?;
        let records = statement
            .query_map([limit.clamp(1, 100)], |row| {
                Ok(OperationHistoryRecord {
                    job_id: row.get(0)?,
                    operation_kind: row.get(1)?,
                    source_count: row.get::<_, i64>(2)? as u64,
                    representative_source_path: row.get(3)?,
                    destination_path: row.get(4)?,
                    status: row.get(5)?,
                    started_at: row.get(6)?,
                    completed_at: row.get(7)?,
                    error_code: row.get(8)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(records)
    }

    fn connect(&self) -> rusqlite::Result<Connection> {
        Connection::open(&*self.path)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationHistoryRecord {
    pub job_id: String,
    pub operation_kind: String,
    pub source_count: u64,
    pub representative_source_path: Option<String>,
    pub destination_path: Option<String>,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error_code: Option<String>,
}

fn update_snapshot_progress(
    jobs: &Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    progress: &jobs::JobProgressEvent,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(state) = jobs.get_mut(progress.job_id.as_str()) {
            state.snapshot.current_item = progress.current_item.clone();
            state.snapshot.completed_items = progress.completed_items;
            state.snapshot.completed_bytes = progress.completed_bytes;
            state.snapshot.updated_at = progress.updated_at;
        }
    }
}

fn update_snapshot_status(
    jobs: &Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    job_id: &JobId,
    status: JobStatus,
    error_code: Option<String>,
    message: Option<String>,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(state) = jobs.get_mut(job_id.as_str()) {
            state.snapshot.status = status;
            state.snapshot.error_code = error_code;
            state.snapshot.message = message;
            state.snapshot.updated_at = Utc::now();
        }
    }
}

fn status_string(status: JobStatus) -> &'static str {
    match status {
        JobStatus::Queued => "queued",
        JobStatus::Running => "running",
        JobStatus::Paused => "paused",
        JobStatus::Cancelled => "cancelled",
        JobStatus::Completed => "completed",
        JobStatus::Failed => "failed",
    }
}

fn default_history_path() -> PathBuf {
    std::env::var_os("FILEOCTOPUS_HISTORY_DB")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".fileoctopus")
                .join("operation-history.sqlite")
        })
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;
    use vfs::ResourceUri;

    #[test]
    fn boot_registers_local_provider() {
        let state = AppCore::boot().unwrap();
        let uri = ResourceUri::parse("local:///Users").unwrap();
        let provider = state.vfs().provider_for(&uri).unwrap();

        assert_eq!(provider.id().as_str(), "local");
    }

    #[test]
    fn operation_history_migration_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let repository =
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap();

        repository.migrate().unwrap();
        repository.migrate().unwrap();

        assert!(repository.list_recent(10).unwrap().is_empty());
    }

    #[test]
    fn successful_operation_is_persisted_as_completed() {
        let dir = tempfile::tempdir().unwrap();
        let history_path = dir.path().join("history.sqlite");
        let runtime = OperationRuntime::new(OperationHistoryRepository::new(history_path).unwrap());
        let source = dir.path().join("source.txt");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, b"content").unwrap();
        std::fs::create_dir(&destination).unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        runtime
            .start(
                plan,
                Arc::new(move |event| {
                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        let mut events = Vec::new();
        let terminal = loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
            let is_terminal = matches!(event, JobEvent::Completed(_));

            events.push(event.clone());
            if is_terminal {
                break event;
            }
        };

        assert!(matches!(terminal, JobEvent::Completed(_)));
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, JobEvent::Started(_)))
                .count(),
            1
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| {
                    matches!(
                        event,
                        JobEvent::Completed(_) | JobEvent::Failed(_) | JobEvent::Cancelled(_)
                    )
                })
                .count(),
            1
        );
        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "completed");
    }

    #[test]
    fn failed_operation_is_persisted_as_failed() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = OperationRuntime::new(
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        );
        let source = dir.path().join("source.txt");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, b"content").unwrap();
        std::fs::create_dir(&destination).unwrap();
        std::fs::write(destination.join("source.txt"), b"existing").unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        runtime
            .start(
                plan,
                Arc::new(move |event| {
                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

            if matches!(event, JobEvent::Failed(_)) {
                break;
            }
        }

        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "failed");
        assert_eq!(
            history[0].error_code.as_deref(),
            Some("destination_conflict")
        );
    }

    #[test]
    fn cancelled_operation_is_persisted_as_cancelled() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = OperationRuntime::new(
            OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        );
        let source = dir.path().join("large.bin");
        let destination = dir.path().join("dest");
        let (sender, receiver) = mpsc::channel();

        std::fs::write(&source, vec![5_u8; 4 * 1024 * 1024]).unwrap();
        std::fs::create_dir(&destination).unwrap();

        let plan = runtime
            .plan(vfs::FileOperationRequest {
                kind: vfs::FileOperationKind::Copy,
                sources: vec![ResourceUri::from_local_path(&source).unwrap()],
                destination: Some(ResourceUri::from_local_path(&destination).unwrap()),
                new_name: None,
                conflict_policy: vfs::ConflictPolicy::Fail,
            })
            .unwrap();
        let runtime_for_sink = runtime.clone();
        let job = runtime
            .start(
                plan,
                Arc::new(move |event| {
                    if let JobEvent::Progress(progress) = &event {
                        let _ = runtime_for_sink.cancel(progress.job_id.as_str());
                    }

                    let _ = sender.send(event);
                }),
            )
            .unwrap();

        let _ = runtime.cancel(job.job_id.as_str());

        loop {
            let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();

            if matches!(event, JobEvent::Cancelled(_)) {
                break;
            }
        }

        let history = runtime.recent_history(10);
        assert_eq!(history[0].status, "cancelled");
    }
}
