use ethercat::types::{Adapter, MasterSnapshot};

use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub fn list_adapters() -> Result<Vec<Adapter>, IpcError> {
    ethercat::adapter::list_adapters().map_err(IpcError::from)
}

#[tauri::command]
pub async fn start_master(
    state: tauri::State<'_, AppState>,
    ifname: String,
    cycle_us: u32,
) -> Result<(), IpcError> {
    // Initialisation blocks for up to several seconds while slaves transition to OPERATIONAL;
    // run it off the async runtime so the webview stays responsive and can render `Starting`.
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || app.start(&ifname, cycle_us))
        .await
        .map_err(|e| IpcError::internal(format!("engine task failed: {e}")))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn stop_master(state: tauri::State<'_, AppState>) -> Result<(), IpcError> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || app.stop())
        .await
        .map_err(|e| IpcError::internal(format!("engine task failed: {e}")))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub fn get_snapshot(state: tauri::State<'_, AppState>) -> Result<MasterSnapshot, IpcError> {
    Ok(state.snapshot())
}
