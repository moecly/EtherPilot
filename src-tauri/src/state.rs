use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;

use ethercat::types::{EngineEvent, EngineState, MasterSnapshot};
use ethercat::{EthercatError, Master, MasterConfig, SharedState};
use parking_lot::Mutex;

/// `SCHED_FIFO` priority for the cycle thread. `0` (the default) disables real-time scheduling and
/// memory locking entirely. This is deliberate: this engine shares its process with GTK/WebKit, and
/// promoting the cycle thread above the compositor — or locking the whole GUI process's memory —
/// has been observed to drive the app to ~12 GB RSS and a machine-wide OOM. Set `ECAT_RT_PRIORITY`
/// (e.g. `80`) to opt back in; see also `crates/ethercat/src/rt.rs`.
fn rt_priority() -> i32 {
    std::env::var("ECAT_RT_PRIORITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
}

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
                rt_priority: rt_priority(),
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
