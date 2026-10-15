use serde::Serialize;

use ethercat::EthercatError;

/// The single error shape every IPC command returns, so the frontend always receives `{ code,
/// message }`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
}

impl IpcError {
    pub fn internal(message: String) -> IpcError {
        IpcError {
            code: "internal".to_string(),
            message,
        }
    }
}

impl From<EthercatError> for IpcError {
    fn from(err: EthercatError) -> IpcError {
        IpcError {
            code: err.code().to_string(),
            message: err.to_string(),
        }
    }
}
