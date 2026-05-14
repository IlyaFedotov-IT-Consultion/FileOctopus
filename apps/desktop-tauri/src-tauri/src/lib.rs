use std::sync::Arc;

use app_core::{AppCore, AppState, OperationHistoryRecord};
use app_ipc::{
    job_event_name, job_event_payload, CancelJobRequest, DirectoryBatchEventDto, IpcError,
    JobStatusRequest, JobStatusResponse, ListRecentOperationsRequest, ListRecentOperationsResponse,
    ListStartRequest, ListStartResponse, OperationHistoryRecordDto, PlanFileOperationRequest,
    PlanFileOperationResponse, StartFileOperationRequest, StartFileOperationResponse, StatRequest,
    StatResponse, DIRECTORY_BATCH_EVENT,
};
use jobs::JobEvent;
use tauri::{AppHandle, Emitter, State};
use vfs::{DirectoryBatch, ListOptions, ListSessionId, ResourceUri};

#[tauri::command]
fn app_get_info() -> serde_json::Value {
    serde_json::json!({
        "name": "FileOctopus",
        "version": env!("CARGO_PKG_VERSION")
    })
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
            list_recent_operations
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
