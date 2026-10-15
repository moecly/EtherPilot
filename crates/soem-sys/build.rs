use std::path::PathBuf;

fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap();
    assert!(
        matches!(target_os.as_str(), "linux" | "windows"),
        "SOEM 2.0.0 has no CMake target for '{target_os}': vendor/SOEM/cmake ships Linux.cmake \
         and Windows.cmake only. Add a platform file to the pinned SOEM revision (plus \
         oshw/<os> and osal/<os>) before targeting this OS."
    );

    println!("cargo:rerun-if-changed=wrapper.h");
    println!("cargo:rerun-if-changed=../../vendor/SOEM");
    println!("cargo:rerun-if-env-changed=SOEM_PATH");

    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let soem_src = std::env::var("SOEM_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest.join("../../vendor/SOEM"))
        .canonicalize()
        .expect("vendor/SOEM missing - run `git submodule update --init --recursive`");

    let dst = cmake::Config::new(&soem_src)
        .define("SOEM_BUILD_SAMPLES", "OFF")
        .define("BUILD_SHARED_LIBS", "OFF")
        .define("CMAKE_BUILD_TYPE", "RelWithDebInfo")
        .build();

    println!("cargo:rustc-link-search=native={}/lib", dst.display());
    println!("cargo:rustc-link-lib=static=soem");
    if target_os == "linux" {
        println!("cargo:rustc-link-lib=pthread");
        println!("cargo:rustc-link-lib=rt");
    }

    let plat = if target_os == "linux" {
        "linux"
    } else {
        "win32"
    };
    let includes = [
        soem_src.join("include"),              // soem/*.h
        dst.join("build/include"),             // generated soem/ec_options.h
        soem_src.join("osal"),                 // osal/osal.h
        soem_src.join(format!("osal/{plat}")), // osal_defs.h
        soem_src.join(format!("oshw/{plat}")), // nicdrv.h, oshw.h
    ];

    let mut builder = bindgen::Builder::default()
        .header(manifest.join("wrapper.h").to_string_lossy().into_owned())
        .allowlist_function("ecx?_.*")
        .allowlist_function("osal_.*")
        .allowlist_type("ec(x)?_.*")
        .allowlist_type("osal_.*")
        .allowlist_var("EC_.*")
        .allowlist_var("ECT_.*")
        .derive_default(true);
    for inc in &includes {
        builder = builder.clang_arg(format!("-I{}", inc.display()));
    }

    let bindings = builder
        .generate()
        .expect("bindgen could not parse the SOEM headers");
    bindings
        .write_to_file(PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("bindings.rs"))
        .expect("could not write bindings.rs");
}
