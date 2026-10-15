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
            commands::sdo_read,
            commands::sdo_write,
            commands::read_od_list,
            commands::read_od_entry,
            commands::read_pdo_map,
            commands::write_pdo_map,
            commands::ack_slave_error,
            commands::recover_slave,
            commands::rebuild_bus,
            commands::set_slave_outputs,
            commands::set_auto_recover,
            commands::set_process_data_capture,
        ])
        .setup(move |app| {
            bridge::spawn(app.handle().clone(), bridge_state.clone(), events);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running EtherPilot");
}
