//! Adapter enumeration is the hardware-free proof that SOEM is linked and callable.

#[test]
fn lists_at_least_the_loopback_adapter() {
    let adapters = ethercat::adapter::list_adapters().expect("adapter enumeration failed");
    // The loopback interface always exists, so the list is never empty on a normal host.
    assert!(
        !adapters.is_empty(),
        "expected at least one network adapter (loopback always exists)"
    );
    for adapter in &adapters {
        assert!(
            !adapter.name.is_empty(),
            "adapter with empty name: {adapter:?}"
        );
    }
}
