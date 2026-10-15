mod bridge;
mod commands;
mod error;
mod state;

use state::AppState;

pub fn run() {
    let (state, events) = AppState::new();
    let bridge_state = state.clone();
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::list_adapters,
            commands::start_master,
            commands::stop_master,
            commands::get_snapshot,
        ])
        .setup(move |app| {
            bridge::spawn(app.handle().clone(), bridge_state.clone(), events);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running EtherPilot");
}
