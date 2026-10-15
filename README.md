# EtherPilot

Cross-platform EtherCAT master GUI built on [SOEM](https://github.com/OpenEtherCATsociety/SOEM),
Tauri 2, React/TypeScript and Rust.

EtherPilot enumerates the host's network adapters, connects to one as a live EtherCAT master, and
streams slave topology, AL states, WKC, cycle time and jitter into the UI.

## Getting started

```bash
git submodule update --init --recursive   # vendored SOEM (pinned v2.0.0)
nix develop                               # or let direnv enter the shell
just ci                                   # format + lint + test + SOEM smoke
pnpm tauri dev                            # launch the app
```

## Raw-socket capability

SOEM opens `AF_PACKET` sockets, so the binary needs `CAP_NET_RAW` (and `CAP_NET_ADMIN` for
promiscuous mode). The supported way to run is to grant the capability rather than run as root:

```bash
sudo setcap cap_net_raw,cap_net_admin+eip target/debug/etherpilot
```

The capability is lost on every rebuild and must be re-applied. `sudo pnpm tauri dev` is not
supported: running the whole GUI stack as root also grants the engine real-time scheduling and
memory locking on a process shared with GTK/WebKit, which has driven the app to ~12 GB RSS and a
machine-wide OOM.

## Real-time scheduling (opt-in, off by default)

The cycle thread can run under `SCHED_FIFO` with locked memory, but this is **disabled by default**.
Enabling it lets the engine out-rank the compositor and pin the whole GUI process's memory, so opt
in only after validating it on your machine:

```bash
sudo setcap cap_net_raw,cap_net_admin,cap_sys_nice,cap_ipc_lock+eip target/debug/etherpilot
ECAT_RT_PRIORITY=80 pnpm tauri dev
```

`ECAT_RT_PRIORITY=0` (the default) skips both `SCHED_FIFO` and `mlockall`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
