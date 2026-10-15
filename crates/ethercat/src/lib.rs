//! Safe EtherCAT master engine built on the vendored SOEM library.

pub mod adapter;
pub mod error;
pub mod master;
pub mod request;
pub mod rt;
pub mod sdo;
pub mod types;

pub use error::EthercatError;
pub use master::{Master, MasterConfig, SharedState};
