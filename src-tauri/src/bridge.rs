use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::Duration;

use ethercat::types::EngineEvent;
use tauri::Emitter;

use crate::state::AppState;

/// Forward engine events into the webview. A 100 ms tick decouples the UI from the cycle rate, so a
/// 250 us cycle does not flood it with snapshot events.
pub fn spawn(app: tauri::AppHandle, state: AppState, events: Receiver<EngineEvent>) {
    std::thread::Builder::new()
        .name("ecat-ipc".into())
        .spawn(move || loop {
            match events.recv_timeout(Duration::from_millis(100)) {
                Ok(EngineEvent::Log(log)) => {
                    let _ = app.emit("ecat:log", &log);
                    let _ = app.emit("ecat:snapshot", &state.snapshot());
                }
                Ok(EngineEvent::Stopped { reason }) => {
                    let _ = app.emit("ecat:stopped", serde_json::json!({ "reason": reason }));
                    let _ = app.emit("ecat:snapshot", &state.snapshot());
                }
                Err(RecvTimeoutError::Timeout) => {
                    let _ = app.emit("ecat:snapshot", &state.snapshot());
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        })
        .expect("could not spawn the IPC bridge thread");
}
