#![allow(
    non_upper_case_globals,
    non_camel_case_types,
    non_snake_case,
    dead_code,
    clippy::all
)]

include!(concat!(env!("OUT_DIR"), "/bindings.rs"));

/// Heap-allocate a zeroed SOEM master context.
///
/// The context must outlive every SOEM call made with its pointer and must never move:
/// `slavelist[i].inputs` / `.outputs` point into the IOmap buffer passed to
/// `ecx_config_map_group`, and `Box` gives a stable address for the engine thread's lifetime.
pub fn context_new() -> Box<ecx_contextt> {
    // `ecx_contextt` holds only integers, arrays and pointers, so all-zero is a valid value.
    unsafe { Box::new(std::mem::zeroed()) }
}
