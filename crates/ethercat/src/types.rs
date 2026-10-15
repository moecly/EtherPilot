//! Shared data model for the EtherCAT engine. Every struct here is part of the IPC contract with
//! the TypeScript frontend, so serialized field names use camelCase.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Adapter {
    pub name: String,
    pub desc: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EngineLog {
    pub at_us: u64,
    pub level: LogLevel,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum EngineEvent {
    Log(EngineLog),
    Stopped { reason: String },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineState {
    Idle,
    Starting,
    Running,
    Failed,
    Stopped,
}

/// EtherCAT Application Layer state, decoded from the low nibble of `ec_slavet.state`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AlState {
    Init,
    PreOp,
    Boot,
    SafeOp,
    Operational,
    Unknown,
}

impl AlState {
    /// The error flag (`raw & 0x10`) is carried separately, so `0x14` decodes to `SafeOp` + error.
    pub fn from_raw(raw: u16) -> AlState {
        match raw & 0x0f {
            1 => AlState::Init,
            2 => AlState::PreOp,
            3 => AlState::Boot,
            4 => AlState::SafeOp,
            8 => AlState::Operational,
            _ => AlState::Unknown,
        }
    }
}

/// One entry per slave, position 1..=slavecount (index 0 is SOEM's virtual broadcast slave).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SlaveInfo {
    pub position: u16,
    pub name: String,
    pub config_addr: u16,
    pub alias: u16,
    pub vendor_id: u32,
    pub product_code: u32,
    pub revision: u32,
    pub serial: u32,
    pub al_state_raw: u16,
    pub al_state: AlState,
    pub al_state_error: bool,
    pub al_status_code: u16,
    pub al_status_text: String,
    pub input_bits: u16,
    pub output_bits: u16,
    pub input_bytes: u32,
    pub output_bytes: u32,
    pub has_dc: bool,
    pub is_lost: bool,
    pub topology: u8,
    pub active_ports: u8,
    pub group: u8,
    pub parent: u16,
    pub parent_port: u8,
    pub entry_port: u8,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CycleStats {
    pub cycle_index: u64,
    pub wkc: i32,
    pub expected_wkc: i32,
    pub wkc_ok: bool,
    pub cycle_time_us: i64,
    pub jitter_us: i64,
    pub dc_time_ns: i64,
    pub lost_frames: u64,
    pub min_cycle_us: i64,
    pub max_cycle_us: i64,
    pub avg_cycle_us: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MasterSnapshot {
    pub state: EngineState,
    pub iface: Option<String>,
    pub cycle_us: u32,
    pub slave_count: i32,
    pub group0_input_bytes: u32,
    pub group0_output_bytes: u32,
    pub segments: u16,
    pub slaves: Vec<SlaveInfo>,
    pub cycle: CycleStats,
    pub updated_at_us: u64,
}

impl Default for MasterSnapshot {
    fn default() -> Self {
        MasterSnapshot {
            state: EngineState::Idle,
            iface: None,
            cycle_us: 0,
            slave_count: 0,
            group0_input_bytes: 0,
            group0_output_bytes: 0,
            segments: 0,
            slaves: Vec::new(),
            cycle: CycleStats::default(),
            updated_at_us: 0,
        }
    }
}
