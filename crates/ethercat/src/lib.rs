//! Safe EtherCAT master engine built on the vendored SOEM library.

pub mod adapter;
pub mod error;
pub mod master;
pub mod rt;
pub mod types;

pub use error::EthercatError;
pub use master::{Master, MasterConfig, SharedState};
