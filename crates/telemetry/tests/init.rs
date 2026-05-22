#[test]
fn init_is_repeatable() {
    telemetry::init().unwrap();
    telemetry::init().unwrap();
}

#[test]
fn default_filter_includes_workspace_crate_targets() {
    let filter = telemetry::default_filter_directives();

    for target in [
        "app_core",
        "fileoctopus_desktop_lib",
        "fs_core",
        "remote_core",
        "terminal_core",
    ] {
        assert!(
            filter.contains(target),
            "default telemetry filter should include {target}"
        );
    }
}
