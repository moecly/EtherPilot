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

The capability is lost on every rebuild and must be re-applied. `sudo pnpm tauri dev` also works but
is not the documented path.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
