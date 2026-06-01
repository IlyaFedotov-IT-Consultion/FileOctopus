use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    GetPreferencesResponse, IpcError, SetPreferenceRequest, SetPreferenceResponse,
    UserPreferencesDto,
};
use tauri::State;

#[tauri::command]
pub fn get_preferences(
    state: State<'_, Arc<AppState>>,
) -> Result<GetPreferencesResponse, IpcError> {
    let preferences = state
        .preferences()
        .get_all()
        .map_err(|error| IpcError::preferences_error(error.to_string()))?;

    Ok(GetPreferencesResponse {
        preferences: UserPreferencesDto::from(preferences),
    })
}

#[tauri::command]
pub fn set_preference(
    request: SetPreferenceRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<SetPreferenceResponse, IpcError> {
    let preferences = state
        .preferences()
        .set(&request.key, &request.value)
        .map_err(|error| IpcError::preferences_error(error.to_string()))?;

    if request.key == "operationIdleTimeoutSecs" {
        let secs = preferences.operation_idle_timeout_secs;
        state
            .operations()
            .set_idle_timeout((secs > 0).then(|| std::time::Duration::from_secs(u64::from(secs))));
    }

    Ok(SetPreferenceResponse {
        preferences: UserPreferencesDto::from(preferences),
    })
}
