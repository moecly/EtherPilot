use crate::types::EngineState;

#[derive(Debug, thiserror::Error)]
pub enum EthercatError {
    #[error("a master session is already running")]
    AlreadyRunning,
    #[error("no master session is running")]
    NotRunning,
    #[error("ecx_init failed for interface '{iface}' (os error {os_error:?})")]
    SocketInit {
        iface: String,
        os_error: Option<i32>,
    },
    #[error("no EtherCAT slaves found on '{iface}'")]
    NoSlaves { iface: String },
    #[error("EtherCAT configuration failed: {0}")]
    Config(String),
    #[error("engine thread did not start")]
    ThreadStart,
    #[error("engine thread panicked")]
    Join,
    #[error("engine request timed out")]
    RequestTimeout,
    #[error(
        "SDO abort 0x{abort_code:08X} on slave {slave} 0x{index:04X}:{subindex:02X}: {detail}"
    )]
    SdoAbort {
        slave: u16,
        index: u16,
        subindex: u8,
        abort_code: u32,
        detail: String,
    },
    #[error("{0}")]
    NotSupported(String),
    #[error("{0}")]
    InvalidArgument(String),
}

impl EthercatError {
    /// Stable machine-readable code the frontend switches on.
    pub fn code(&self) -> &'static str {
        match self {
            EthercatError::AlreadyRunning => "already_running",
            EthercatError::NotRunning => "not_running",
            EthercatError::SocketInit { os_error, .. } => match os_error {
                Some(code) if is_permission_error(*code) => "permission_denied",
                _ => "socket_init",
            },
            EthercatError::NoSlaves { .. } => "no_slaves",
            EthercatError::Config(_) => "config",
            EthercatError::ThreadStart | EthercatError::Join => "internal",
            EthercatError::RequestTimeout => "timeout",
            EthercatError::SdoAbort { .. } => "sdo_abort",
            EthercatError::NotSupported(_) => "not_supported",
            EthercatError::InvalidArgument(_) => "invalid_argument",
        }
    }
}

#[cfg(target_os = "linux")]
fn is_permission_error(code: i32) -> bool {
    code == libc::EPERM
}

#[cfg(not(target_os = "linux"))]
fn is_permission_error(_code: i32) -> bool {
    false
}

/// Convenience mapping for callers that only need a status enum.
impl From<&EthercatError> for EngineState {
    fn from(err: &EthercatError) -> EngineState {
        match err {
            EthercatError::AlreadyRunning => EngineState::Running,
            EthercatError::NotRunning => EngineState::Idle,
            _ => EngineState::Failed,
        }
    }
}
