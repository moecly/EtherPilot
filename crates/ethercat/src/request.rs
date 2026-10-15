//! The IPC -> engine request channel. Every SOEM call still happens on the single engine thread;
//! the IPC side only ever hands over a request and waits for the reply.

use std::sync::mpsc::Sender;

use crate::error::EthercatError;
use crate::types::{OdEntry, OdList, PdoMap, PdoMapUpdate, SdoValue, ValueFormat};

/// Where the engine sends exactly one reply for each request.
pub type Reply = Sender<Result<EngineResponse, EthercatError>>;

/// A unit of work the engine executes between two process-data cycles.
pub enum EngineRequest {
    SdoRead {
        slave: u16,
        index: u16,
        subindex: u8,
        complete_access: bool,
        reply: Reply,
    },
    SdoWrite {
        slave: u16,
        index: u16,
        subindex: u8,
        complete_access: bool,
        data_type: Option<u16>,
        format: ValueFormat,
        value: String,
        reply: Reply,
    },
    ReadOdList {
        slave: u16,
        reply: Reply,
    },
    ReadOdEntry {
        slave: u16,
        index: u16,
        first_subindex: u8,
        reply: Reply,
    },
    ReadPdoMap {
        slave: u16,
        reply: Reply,
    },
    WritePdoMap {
        slave: u16,
        update: PdoMapUpdate,
        reply: Reply,
    },
    /// `slave == 0` acks every slave (broadcast).
    AckError {
        slave: u16,
        reply: Reply,
    },
    RecoverSlave {
        slave: u16,
        reply: Reply,
    },
    RebuildBus {
        reply: Reply,
    },
    SetSlaveOutputs {
        slave: u16,
        data: Vec<u8>,
        reply: Reply,
    },
    SetAutoRecover {
        enabled: bool,
        reply: Reply,
    },
    SetProcessDataCapture {
        enabled: bool,
        reply: Reply,
    },
}

/// Responses that carry no payload (write/ack/flag acknowledgements).
pub enum EngineResponse {
    None,
    Sdo(SdoValue),
    OdList(OdList),
    OdEntry(OdEntry),
    PdoMap(PdoMap),
    OutputsWritten,
}

impl EngineRequest {
    /// The channel the engine must reply on exactly once, whatever the outcome.
    pub fn reply(&self) -> &Reply {
        match self {
            EngineRequest::SdoRead { reply, .. }
            | EngineRequest::SdoWrite { reply, .. }
            | EngineRequest::ReadOdList { reply, .. }
            | EngineRequest::ReadOdEntry { reply, .. }
            | EngineRequest::ReadPdoMap { reply, .. }
            | EngineRequest::WritePdoMap { reply, .. }
            | EngineRequest::AckError { reply, .. }
            | EngineRequest::RecoverSlave { reply, .. }
            | EngineRequest::RebuildBus { reply }
            | EngineRequest::SetSlaveOutputs { reply, .. }
            | EngineRequest::SetAutoRecover { reply, .. }
            | EngineRequest::SetProcessDataCapture { reply, .. } => reply,
        }
    }

    /// Short label for the "cycle paused" log line.
    pub fn label(&self) -> String {
        match self {
            EngineRequest::SdoRead {
                slave,
                index,
                subindex,
                ..
            } => {
                format!("SDO read slave {slave} 0x{index:04X}:{subindex:02X}")
            }
            EngineRequest::SdoWrite {
                slave,
                index,
                subindex,
                ..
            } => {
                format!("SDO write slave {slave} 0x{index:04X}:{subindex:02X}")
            }
            EngineRequest::ReadOdList { slave, .. } => format!("OD list slave {slave}"),
            EngineRequest::ReadOdEntry { slave, index, .. } => {
                format!("OD entry slave {slave} 0x{index:04X}")
            }
            EngineRequest::ReadPdoMap { slave, .. } => format!("PDO map slave {slave}"),
            EngineRequest::WritePdoMap { slave, .. } => format!("PDO remap slave {slave}"),
            EngineRequest::AckError { slave, .. } => format!("ack error slave {slave}"),
            EngineRequest::RecoverSlave { slave, .. } => format!("recover slave {slave}"),
            EngineRequest::RebuildBus { .. } => "rebuild bus".to_string(),
            EngineRequest::SetSlaveOutputs { slave, .. } => format!("set outputs slave {slave}"),
            EngineRequest::SetAutoRecover { enabled, .. } => {
                format!("auto-recover {}", if *enabled { "on" } else { "off" })
            }
            EngineRequest::SetProcessDataCapture { enabled, .. } => {
                format!("process capture {}", if *enabled { "on" } else { "off" })
            }
        }
    }
}
