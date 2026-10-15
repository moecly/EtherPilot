//! Best-effort real-time setup for the cycle thread. Both operations are allowed to fail; the engine
//! logs a warning and continues on the default scheduler.

#[cfg(target_os = "linux")]
pub fn promote_current_thread(prio: i32) -> Result<(), (i32, std::io::Error)> {
    let param = libc::sched_param {
        sched_priority: prio,
    };
    // SAFETY: `sched_setscheduler` with pid 0 targets the calling thread; `param` is valid for the
    // duration of the call.
    let rc = unsafe { libc::sched_setscheduler(0, libc::SCHED_FIFO, &param) };
    if rc == 0 {
        Ok(())
    } else {
        Err((prio, std::io::Error::last_os_error()))
    }
}

#[cfg(target_os = "linux")]
pub fn lock_memory() -> Result<(), std::io::Error> {
    // MCL_CURRENT only, never MCL_FUTURE: this runs inside the whole Tauri/WebKit GUI process, so
    // MCL_FUTURE would make every later allocation (GTK/WebKit/GL/GPU buffers) unswappable and
    // unreclaimable — the app then exhausts RAM and the OOM killer takes down the desktop.
    // SAFETY: no arguments; affects only the calling process's address space.
    let rc = unsafe { libc::mlockall(libc::MCL_CURRENT) };
    if rc == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(not(target_os = "linux"))]
pub fn promote_current_thread(_prio: i32) -> Result<(), (i32, std::io::Error)> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn lock_memory() -> Result<(), std::io::Error> {
    Ok(())
}
