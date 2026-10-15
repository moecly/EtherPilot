//! Network adapter enumeration. Needs no privilege, so it is the hardware-free proof that SOEM is
//! linked and callable through the FFI layer.

use std::ffi::CStr;

use crate::error::EthercatError;
use crate::types::Adapter;

/// Read the null-terminated `char[N]` field of `ec_adaptert` as an owned `String`.
fn c_array_to_string(buf: &[std::os::raw::c_char]) -> String {
    let ptr = buf.as_ptr();
    if ptr.is_null() {
        return String::new();
    }
    // SAFETY: SOEM fills both `name` and `desc` with null-terminated C strings.
    unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned()
}

pub fn list_adapters() -> Result<Vec<Adapter>, EthercatError> {
    let head = unsafe { soem_sys::ec_find_adapters() };
    if head.is_null() {
        return Ok(Vec::new());
    }

    let mut adapters = Vec::new();
    let mut cur = head;
    while !cur.is_null() {
        // SAFETY: `cur` is a node of the list SOEM allocated; `next` is either null or valid.
        let node = unsafe { &*cur };
        adapters.push(Adapter {
            name: c_array_to_string(&node.name),
            desc: c_array_to_string(&node.desc),
        });
        cur = node.next;
    }

    // SOEM heap-allocates the list; always release it, even on the happy path.
    unsafe { soem_sys::ec_free_adapters(head) };

    Ok(adapters)
}
