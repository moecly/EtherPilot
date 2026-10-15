use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;

use ethercat::types::{EngineEvent, EngineState, MasterSnapshot};
use ethercat::{EthercatError, Master, MasterConfig, SharedState};
use parking_lot::Mutex;

/// Priority requested for the cycle thread's `SCHED_FIFO` scheduling.
const RT_PRIORITY: i32 = 80;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<Mutex<Inner>>,
    events: Sender<EngineEvent>,
}

struct Inner {
    master: Option<Master>,
    shared: Option<Arc<SharedState>>,
    /// Last composed snapshot, so the UI has data before the first event arrives.
    last: MasterSnapshot,
}

impl AppState {
    /// Create the process-lifetime event channel once. The `Sender` is retained here and cloned into
    /// every `Master::start`; the `Receiver` goes to the bridge thread.
    pub fn new() -> (AppState, Receiver<EngineEvent>) {
        let (events, receiver) = std::sync::mpsc::channel();
        (
            AppState {
                inner: Arc::new(Mutex::new(Inner {
                    master: None,
                    shared: None,
                    last: MasterSnapshot::default(),
                })),
                events,
            },
            receiver,
        )
    }

    pub fn start(&self, ifname: &str, cycle_us: u32) -> Result<(), EthercatError> {
        let mut inner = self.inner.lock();
        if inner.master.is_some() {
            return Err(EthercatError::AlreadyRunning);
        }
        inner.last.state = EngineState::Starting;
        inner.last.iface = Some(ifname.to_string());

        match Master::start(
            MasterConfig {
                iface: ifname.to_string(),
                cycle_us,
                rt_priority: RT_PRIORITY,
            },
            self.events.clone(),
        ) {
            Ok(master) => {
                let shared = master.shared();
                inner.last = shared.snapshot();
                inner.shared = Some(shared);
                inner.master = Some(master);
                Ok(())
            }
            Err(err) => {
                inner.last.state = EngineState::Failed;
                Err(err)
            }
        }
    }

    pub fn stop(&self) -> Result<(), EthercatError> {
        let mut inner = self.inner.lock();
        let master = inner.master.take().ok_or(EthercatError::NotRunning)?;
        let shared = inner.shared.take();
        // Release the lock while the engine thread tears down, so `get_snapshot` stays responsive.
        drop(inner);

        let result = master.stop();
        let mut inner = self.inner.lock();
        if let Some(shared) = shared {
            inner.last = shared.snapshot();
        }
        inner.last.state = EngineState::Idle;
        result
    }

    pub fn snapshot(&self) -> MasterSnapshot {
        let inner = self.inner.lock();
        match &inner.shared {
            Some(shared) => shared.snapshot(),
            None => inner.last.clone(),
        }
    }
}
