default:
    @just --list

# Enter the Nix development shell.
develop:
    nix develop

# Build the frontend bundle (must run before compiling src-tauri).
frontend:
    pnpm install --frozen-lockfile
    pnpm build

# Grant the raw-socket capability to the freshly built binary. `setcap` is stored on the file, so
# cargo overwrites it on every relink — re-apply after each build.
cap:
    sudo setcap cap_net_raw,cap_net_admin+eip target/debug/etherpilot

# Build, grant the raw-socket capability, then launch the dev loop. The build must come *before*
# `setcap` and `tauri dev` must reuse that fresh binary, otherwise the relink drops the capability
# and `ecx_init` fails with `os error Some(1)` again.
# Real-time scheduling + memory locking are opt-in and OFF by default; see README to enable them.
# Needs port 1425 free (Vite dev server and the Tauri devUrl).
run:
    cargo build -p etherpilot
    just cap
    pnpm tauri dev

# Build the vendored SOEM library and its samples (independent smoke test of the submodule).
soem-build:
    cmake -S vendor/SOEM -B build/soem -G Ninja -DSOEM_BUILD_SAMPLES=ON -DCMAKE_BUILD_TYPE=RelWithDebInfo
    cmake --build build/soem

# Ask SOEM's own unmodified sample which adapters it can see.
soem-smoke: soem-build
    ./build/soem/samples/simple_ng/simple_ng | grep -q "Available adapters:"

# Format check (Rust + Nix).
fmt-check:
    cargo fmt --all -- --check
    nixfmt --check flake.nix

# Lint all Rust crates with warnings denied.
lint: frontend
    cargo clippy --workspace --all-targets -- -D warnings

# Test all Rust crates.
test: frontend
    cargo test --workspace

# Full CI gate.
ci: fmt-check lint test soem-smoke

# Check the Nix flake.
check:
    nix flake check

# Update flake inputs.
update:
    nix flake update

# Show flake outputs.
show:
    nix flake show

# Format Nix files.
fmt:
    nix fmt
