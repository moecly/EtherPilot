use ethercat::request::{EngineRequest, EngineResponse, Reply};
use ethercat::types::{
    Adapter, MasterSnapshot, OdEntry, OdList, PdoMap, PdoMapUpdate, SdoValue, ValueFormat,
};

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

/// Submit `make` to the engine on a blocking thread and map the reply through `extract`.
async fn dispatch<T, M, E>(app: AppState, make: M, extract: E) -> Result<T, IpcError>
where
    T: Send + 'static,
    M: FnOnce(Reply) -> EngineRequest + Send + 'static,
    E: FnOnce(EngineResponse) -> Result<T, IpcError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || match app.dispatch(make) {
        Ok(response) => extract(response),
        Err(e) => Err(IpcError::from(e)),
    })
    .await
    .map_err(|e| IpcError::internal(format!("engine request task failed: {e}")))?
}

fn expect_sdo(response: EngineResponse) -> Result<SdoValue, IpcError> {
    match response {
        EngineResponse::Sdo(v) => Ok(v),
        _ => Err(IpcError::internal("unexpected engine response".to_string())),
    }
}

fn expect_unit(response: EngineResponse) -> Result<(), IpcError> {
    match response {
        EngineResponse::None | EngineResponse::OutputsWritten => Ok(()),
        _ => Err(IpcError::internal("unexpected engine response".to_string())),
    }
}

#[tauri::command]
pub async fn sdo_read(
    state: tauri::State<'_, AppState>,
    slave: u16,
    index: u16,
    subindex: u8,
    complete_access: bool,
) -> Result<SdoValue, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::SdoRead {
            slave,
            index,
            subindex,
            complete_access,
            reply,
        },
        expect_sdo,
    )
    .await
}

#[tauri::command]
// Flat arguments mirror the wire contract the frontend sends; grouping them would change it.
#[allow(clippy::too_many_arguments)]
pub async fn sdo_write(
    state: tauri::State<'_, AppState>,
    slave: u16,
    index: u16,
    subindex: u8,
    complete_access: bool,
    data_type: Option<u16>,
    format: ValueFormat,
    value: String,
) -> Result<SdoValue, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::SdoWrite {
            slave,
            index,
            subindex,
            complete_access,
            data_type,
            format,
            value,
            reply,
        },
        expect_sdo,
    )
    .await
}

#[tauri::command]
pub async fn read_od_list(
    state: tauri::State<'_, AppState>,
    slave: u16,
) -> Result<OdList, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::ReadOdList { slave, reply },
        |response| match response {
            EngineResponse::OdList(v) => Ok(v),
            _ => Err(IpcError::internal("unexpected engine response".to_string())),
        },
    )
    .await
}

#[tauri::command]
pub async fn read_od_entry(
    state: tauri::State<'_, AppState>,
    slave: u16,
    index: u16,
    first_subindex: u8,
) -> Result<OdEntry, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::ReadOdEntry {
            slave,
            index,
            first_subindex,
            reply,
        },
        |response| match response {
            EngineResponse::OdEntry(v) => Ok(v),
            _ => Err(IpcError::internal("unexpected engine response".to_string())),
        },
    )
    .await
}

#[tauri::command]
pub async fn read_pdo_map(
    state: tauri::State<'_, AppState>,
    slave: u16,
) -> Result<PdoMap, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::ReadPdoMap { slave, reply },
        |response| match response {
            EngineResponse::PdoMap(v) => Ok(v),
            _ => Err(IpcError::internal("unexpected engine response".to_string())),
        },
    )
    .await
}

#[tauri::command]
pub async fn write_pdo_map(
    state: tauri::State<'_, AppState>,
    slave: u16,
    update: PdoMapUpdate,
) -> Result<PdoMap, IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::WritePdoMap {
            slave,
            update,
            reply,
        },
        |response| match response {
            EngineResponse::PdoMap(v) => Ok(v),
            _ => Err(IpcError::internal("unexpected engine response".to_string())),
        },
    )
    .await
}

#[tauri::command]
pub async fn ack_slave_error(
    state: tauri::State<'_, AppState>,
    slave: u16,
) -> Result<(), IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::AckError { slave, reply },
        expect_unit,
    )
    .await
}

#[tauri::command]
pub async fn recover_slave(state: tauri::State<'_, AppState>, slave: u16) -> Result<(), IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::RecoverSlave { slave, reply },
        expect_unit,
    )
    .await
}

#[tauri::command]
pub async fn rebuild_bus(state: tauri::State<'_, AppState>) -> Result<(), IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::RebuildBus { reply },
        expect_unit,
    )
    .await
}

#[tauri::command]
pub async fn set_slave_outputs(
    state: tauri::State<'_, AppState>,
    slave: u16,
    data_hex: String,
) -> Result<(), IpcError> {
    let data = ethercat::sdo::parse_hex(&data_hex).map_err(IpcError::from)?;
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::SetSlaveOutputs { slave, data, reply },
        expect_unit,
    )
    .await
}

#[tauri::command]
pub async fn set_auto_recover(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::SetAutoRecover { enabled, reply },
        expect_unit,
    )
    .await
}

#[tauri::command]
pub async fn set_process_data_capture(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), IpcError> {
    let app = state.inner().clone();
    dispatch(
        app,
        move |reply| EngineRequest::SetProcessDataCapture { enabled, reply },
        expect_unit,
    )
    .await
}
