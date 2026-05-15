use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use app_core::{AppCore, AppState, OperationHistoryRecord};
use app_ipc::{
    job_event_name, job_event_payload, AppDataHealthResponse, AppInfoResponse, CancelJobRequest,
    ClearOperationHistoryResponse, DirectoryBatchEventDto, ExportDiagnosticsBundleRequest,
    ExportDiagnosticsBundleResponse, IpcError, JobStatusRequest, JobStatusResponse,
    ListRecentOperationsRequest, ListRecentOperationsResponse, ListStartRequest, ListStartResponse,
    OperationHistoryRecordDto, PlanFileOperationRequest, PlanFileOperationResponse,
    StartFileOperationRequest, StartFileOperationResponse, StatRequest, StatResponse,
    DIRECTORY_BATCH_EVENT,
};
use jobs::JobEvent;
use tauri::{AppHandle, Emitter, State};
use vfs::{DirectoryBatch, ListOptions, ListSessionId, ResourceUri};
use zip::write::FileOptions;

#[tauri::command]
fn app_get_info() -> AppInfoResponse {
    AppInfoResponse {
        name: "FileOctopus".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        commit_sha: option_env!("FILEOCTOPUS_COMMIT_SHA")
            .or(option_env!("GIT_COMMIT_SHA"))
            .map(ToString::to_string),
        target_os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
async fn fs_stat(
    request: StatRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<StatResponse, IpcError> {
    telemetry::debug("fs.stat requested");

    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    Ok(StatResponse {
        entry: entry.into(),
    })
}

#[tauri::command]
async fn fs_list_start(
    request: ListStartRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<ListStartResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let session_id = ListSessionId::new(&uuid::Uuid::new_v4().to_string());
    let response = ListStartResponse {
        session_id: session_id.as_str().to_string(),
    };
    let options = ListOptions {
        session_id,
        batch_size: request.batch_size.unwrap_or(256).max(1),
        include_hidden: request.include_hidden.unwrap_or(false),
    };
    let (sender, mut receiver) = tokio::sync::mpsc::channel::<DirectoryBatch>(16);
    let events_app = app.clone();
    let listing_app = app.clone();
    let vfs = state.vfs();
    let list_uri = uri.clone();
    let error_uri = uri.clone();
    let error_session_id = response.session_id.clone();

    telemetry::debug("fs.list_start requested");

    tauri::async_runtime::spawn(async move {
        while let Some(batch) = receiver.recv().await {
            if let Err(error) =
                events_app.emit(DIRECTORY_BATCH_EVENT, DirectoryBatchEventDto::from(batch))
            {
                telemetry::error(&format!("failed to emit directory batch: {error}"));
                break;
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        if let Err(error) = vfs.list(&list_uri, options, sender).await {
            telemetry::error(&format!("directory listing failed: {error}"));
            let event = DirectoryBatchEventDto {
                session_id: error_session_id,
                uri: error_uri.as_str().to_string(),
                entries: Vec::new(),
                batch_index: 0,
                is_complete: true,
                total_hint: None,
                error: Some(IpcError::from(error)),
            };

            let _ = listing_app.emit(DIRECTORY_BATCH_EVENT, event);
        }

        telemetry::debug("fs.list_start completed");
    });

    Ok(response)
}

#[tauri::command]
async fn plan_file_operation(
    request: PlanFileOperationRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<PlanFileOperationResponse, IpcError> {
    telemetry::debug("plan_file_operation requested");

    let operation = request.operation.try_into()?;
    let plan = state.operations().plan(operation).map_err(IpcError::from)?;

    Ok(PlanFileOperationResponse { plan: plan.into() })
}

#[tauri::command]
async fn start_file_operation(
    request: StartFileOperationRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<StartFileOperationResponse, IpcError> {
    telemetry::debug("start_file_operation requested");

    let plan = request.plan.try_into()?;
    let sink_app = app.clone();
    let sink = Arc::new(move |event: JobEvent| {
        let name = job_event_name(&event);
        let payload = job_event_payload(event);

        if let Err(error) = sink_app.emit(name, payload) {
            telemetry::error(&format!("failed to emit job event: {error}"));
        }
    });
    let job = state
        .operations()
        .start(plan, sink)
        .map_err(IpcError::from)?;

    Ok(StartFileOperationResponse { job })
}

#[tauri::command]
async fn cancel_job(
    request: CancelJobRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    let job = state
        .operations()
        .cancel(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
async fn get_job_status(
    request: JobStatusRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    let job = state
        .operations()
        .status(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
async fn list_recent_operations(
    request: ListRecentOperationsRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ListRecentOperationsResponse, IpcError> {
    let operations = state
        .operations()
        .recent_history(request.limit.unwrap_or(20))
        .into_iter()
        .map(operation_history_record_to_dto)
        .collect();

    Ok(ListRecentOperationsResponse { operations })
}

#[tauri::command]
async fn clear_operation_history(
    state: State<'_, Arc<AppState>>,
) -> Result<ClearOperationHistoryResponse, IpcError> {
    let deleted_count = state
        .operations()
        .clear_terminal_history()
        .map_err(|error| IpcError::internal(&error))?;

    Ok(ClearOperationHistoryResponse { deleted_count })
}

#[tauri::command]
async fn diagnostics_app_data_health(
    state: State<'_, Arc<AppState>>,
) -> Result<AppDataHealthResponse, IpcError> {
    let health = state.app_data_health();

    Ok(AppDataHealthResponse {
        config_dir: redact_home(&health.config_dir),
        data_dir: redact_home(&health.data_dir),
        log_dir: redact_home(&health.log_dir),
        database_path: redact_home(&health.database_path),
        database_exists: health.database_exists,
        schema_version: health.schema_version,
        missing_directories: health.missing_directories,
        startup_recovery_count: health.startup_recovery_count,
    })
}

#[tauri::command]
async fn export_diagnostics_bundle(
    request: ExportDiagnosticsBundleRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ExportDiagnosticsBundleResponse, IpcError> {
    let destination = PathBuf::from(request.destination);
    let files = write_diagnostics_bundle(&destination, &state)?;

    Ok(ExportDiagnosticsBundleResponse {
        path: destination.to_string_lossy().to_string(),
        files,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppCore::boot().expect("failed to boot FileOctopus app core");

    tauri::Builder::default()
        .manage(app_state)
        .setup(|_app| {
            telemetry::info("FileOctopus Tauri shell started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_get_info,
            fs_stat,
            fs_list_start,
            plan_file_operation,
            start_file_operation,
            cancel_job,
            get_job_status,
            list_recent_operations,
            clear_operation_history,
            diagnostics_app_data_health,
            export_diagnostics_bundle
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}

fn operation_history_record_to_dto(record: OperationHistoryRecord) -> OperationHistoryRecordDto {
    OperationHistoryRecordDto {
        job_id: record.job_id,
        operation_kind: record.operation_kind,
        source_count: record.source_count,
        representative_source_path: record.representative_source_path,
        destination_path: record.destination_path,
        status: record.status,
        started_at: record.started_at,
        completed_at: record.completed_at,
        error_code: record.error_code,
    }
}

fn write_diagnostics_bundle(destination: &Path, state: &AppState) -> Result<Vec<String>, IpcError> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            IpcError::internal(&format!("failed to create diagnostics directory: {error}"))
        })?;
    }

    let file = File::create(destination).map_err(|error| {
        IpcError::internal(&format!("failed to create diagnostics bundle: {error}"))
    })?;
    let mut archive = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut files = Vec::new();
    let app_info = serde_json::to_vec_pretty(&app_get_info())
        .map_err(|error| IpcError::internal(&format!("failed to serialize app info: {error}")))?;
    let health = state.app_data_health();
    let health = serde_json::json!({
        "configDir": redact_home(&health.config_dir),
        "dataDir": redact_home(&health.data_dir),
        "logDir": redact_home(&health.log_dir),
        "databasePath": redact_home(&health.database_path),
        "databaseExists": health.database_exists,
        "schemaVersion": health.schema_version,
        "missingDirectories": health.missing_directories,
        "startupRecoveryCount": health.startup_recovery_count
    });
    let history = state
        .operations()
        .recent_history(50)
        .into_iter()
        .map(redact_history_record)
        .collect::<Vec<_>>();
    let log_excerpt = read_recent_log_excerpt(&state.paths().log_dir);

    add_archive_file(
        &mut archive,
        options,
        "app-info.json",
        &app_info,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "app-data-health.json",
        &serde_json::to_vec_pretty(&health)
            .map_err(|error| IpcError::internal(&format!("failed to serialize health: {error}")))?,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "operation-history.json",
        &serde_json::to_vec_pretty(&history).map_err(|error| {
            IpcError::internal(&format!("failed to serialize history: {error}"))
        })?,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "recent-log.txt",
        log_excerpt.as_bytes(),
        &mut files,
    )?;
    archive.finish().map_err(|error| {
        IpcError::internal(&format!("failed to finish diagnostics bundle: {error}"))
    })?;

    Ok(files)
}

fn add_archive_file(
    archive: &mut zip::ZipWriter<File>,
    options: FileOptions,
    name: &str,
    contents: &[u8],
    files: &mut Vec<String>,
) -> Result<(), IpcError> {
    archive
        .start_file(name, options)
        .map_err(|error| IpcError::internal(&format!("failed to add diagnostics file: {error}")))?;
    archive.write_all(contents).map_err(|error| {
        IpcError::internal(&format!("failed to write diagnostics file: {error}"))
    })?;
    files.push(name.to_string());

    Ok(())
}

fn redact_history_record(record: OperationHistoryRecord) -> serde_json::Value {
    serde_json::json!({
        "jobId": record.job_id,
        "operationKind": record.operation_kind,
        "sourceCount": record.source_count,
        "representativeSourcePath": record.representative_source_path.map(|path| redact_home(&path)),
        "destinationPath": record.destination_path.map(|path| redact_home(&path)),
        "status": record.status,
        "startedAt": record.started_at,
        "completedAt": record.completed_at,
        "errorCode": record.error_code
    })
}

fn read_recent_log_excerpt(log_dir: &Path) -> String {
    let Some(path) = latest_log_file(log_dir) else {
        return "No log file found.".to_string();
    };
    let Ok(mut file) = File::open(path) else {
        return "Log file could not be opened.".to_string();
    };
    let mut contents = Vec::new();

    if file.read_to_end(&mut contents).is_err() {
        return "Log file could not be read.".to_string();
    }

    let start = contents.len().saturating_sub(64 * 1024);
    String::from_utf8_lossy(&contents[start..]).to_string()
}

fn latest_log_file(log_dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(log_dir)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;

            metadata
                .modified()
                .ok()
                .map(|modified| (modified, entry.path()))
        })
        .max_by_key(|(modified, _)| *modified)
        .map(|(_, path)| path)
}

fn redact_home(value: &str) -> String {
    let Some(home) = home_dir() else {
        return value.to_string();
    };
    let home = home.to_string_lossy();

    value.replace(home.as_ref(), "~")
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_response_has_stable_metadata_fields() {
        let info = app_get_info();

        assert_eq!(info.name, "FileOctopus");
        assert!(!info.version.is_empty());
        assert!(!info.build_profile.is_empty());
        assert!(!info.target_os.is_empty());
    }

    #[test]
    fn diagnostics_bundle_contains_expected_files() {
        let dir = std::env::temp_dir().join(format!(
            "fileoctopus-diagnostics-test-{}",
            uuid::Uuid::new_v4()
        ));

        std::fs::create_dir_all(&dir).unwrap();
        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
        let bundle = dir.join("diagnostics.zip");
        let files = write_diagnostics_bundle(&bundle, &state).unwrap();

        assert!(bundle.exists());
        assert!(files.contains(&"app-info.json".to_string()));
        assert!(files.contains(&"app-data-health.json".to_string()));
        assert!(files.contains(&"operation-history.json".to_string()));
        assert!(files.contains(&"recent-log.txt".to_string()));

        let _ = std::fs::remove_dir_all(dir);
    }
}
