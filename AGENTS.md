# Repository Guidelines

EtherPilot：跨平台 EtherCAT 主站 GUI，基于 [SOEM](https://github.com/OpenEtherCATsociety/SOEM)（vendored v2.0.0）+ Tauri 2 + React/TypeScript + Rust。枚举主机网卡 → 以选中的网卡作为实时 EtherCAT 主站 → 把从站拓扑、AL 状态、WKC、周期时间与抖动流式推送到 UI。许可证 GPL-3.0-or-later。

## 项目概览

- 前端是纯展示层；所有硬件交互在 Rust 侧。
- 引擎是**单条专用线程**驱动 SOEM 过程数据循环，通过无锁 `SharedState` 供 IPC 侧采样。
- 每次运行必须给二进制授予 raw-socket 能力（SOEM 打开 `AF_PACKET`）。

## 架构与数据流

四个层次，单向调用 + 事件回推：

```
React (zustand store)
  └─ invoke("start_master"…)          src/lib/ipc.ts  ← 唯一接触 @tauri-apps/api 的模块
      └─ #[tauri::command]            src-tauri/src/commands.rs
          └─ AppState                 src-tauri/src/state.rs
              └─ Master (engine 线程)  crates/ethercat/src/master.rs
                  └─ soem_sys (FFI)   crates/soem-sys
                      └─ SOEM (C)     vendor/SOEM
```

回推路径：引擎线程 → `std::sync::mpsc` → 桥接线程 `src-tauri/src/bridge.rs`（100ms tick）→ `app.emit("ecat:snapshot" | "ecat:log" | "ecat:stopped")` → store 的 `attach()` 监听并更新状态。

关键点：
- 引擎用 `AtomicU64/AtomicI32/...` 存周期统计，`parking_lot::Mutex` 存 `slaves`、`meta`、`bus_health` 与 `process_data` 快照；`SharedState::snapshot()` 组装 `MasterSnapshot`。稳态循环线程**不分配、不加锁**。每条迭代至多处理一个来自 `mpsc` 的请求（SDO/OD/PDO 读写、Ack/Recover、Reset bus、过程数据开写）**或**一次自动恢复 pass（二者互斥）；请求路径允许分配，处理期间该迭代不计入周期统计。
- `AppState::start()` 用 `spawn_blocking` 执行（初始化可能阻塞数秒，避免冻结 webview）。
- IPC 契约：`crates/ethercat/src/types.rs`（Rust，serde `camelCase`）与 `src/lib/types.ts`（**手工镜像**，须同步字段名与大小写）。

## 关键目录

| 路径 | 作用 |
|---|---|
| `src/` | React 前端。`App.tsx` 布局，`main.tsx` 入口 |
| `src/components/` | 布局/面板组件（`master-toolbar`、`topology-tree`、`slave-state-table`、`cycle-time-chart`、`log-panel`…） |
| `src/components/ui/` | shadcn 基元（`button`、`table`、`select`…），一般不改 |
| `src/store/master.ts` | zustand store：状态、`connect/disconnect/attach`、周期历史环形缓冲（上限 600） |
| `src/lib/` | `ipc.ts`（Tauri 调用）、`types.ts`（IPC 类型）、`format.ts`（hex 格式化）、`utils.ts` |
| `src-tauri/src/` | Tauri 后端：`lib.rs` 装配、`commands.rs`、`state.rs`、`bridge.rs`、`error.rs` |
| `crates/ethercat/` | 安全引擎：`master.rs`、`adapter.rs`、`types.rs`、`error.rs`、`rt.rs` |
| `crates/soem-sys/` | bindgen 生成的 SOEM FFI；`build.rs` 用 CMake 构建 SOEM |
| `vendor/SOEM/` | git submodule（SOEM v2.0.0），勿手工改 |
| `build/soem/` | SOEM 独立 CMake 构建产物（被 gitignore） |

## 开发环境与工具链

- **必须**在 Nix devshell 中工作：`nix develop`（`.envrc` 用 direnv 自动进入）。devshell 提供 rust/clippy/rustfmt/clang/cmake/ninja/nodejs/pnpm 及 WebKitGTK 依赖。**不要依赖宿主机的 rust 安装**。
- 包管理器：**pnpm**（`pnpm-lock.yaml`，`pnpm-workspace.yaml`）。前端脚本：`pnpm dev|build|preview|tauri`。
- 首次需拉取子模块：`git submodule update --init --recursive`。
- Rust：edition 2021，workspace 成员 `crates/soem-sys`、`crates/ethercat`、`src-tauri`。根 `Cargo.toml` 用 `[workspace.dependencies]` 集中版本。
- 目标平台：`crates/soem-sys/build.rs` 仅支持 `linux` / `windows`（SOEM 只带这两个 CMake 平台文件）。
- `.cargo/config.toml` 在 Linux 下加 `--allow-shlib-undefined`（NixOS ld.bfd 所需）。

## 常用命令

用 `just` 驱动（见 `justfile`，`just` 无参即列出）：

```bash
git submodule update --init --recursive
nix develop

just frontend   # pnpm install --frozen-lockfile && pnpm build（编译 src-tauri 前必须先跑）
just run        # cargo build -p etherpilot → setcap → pnpm tauri dev（端口 1425）
just ci         # fmt-check + lint + test + soem-smoke（完整 CI 门禁）

just fmt-check  # cargo fmt --all -- --check + nixfmt --check flake.nix
just lint       # cargo clippy --workspace --all-targets -- -D warnings（先跑 frontend）
just test       # cargo test --workspace（先跑 frontend）
just soem-smoke # 独立构建 SOEM 并验证其样例能看到网卡
```

**raw-socket 能力**（每次 relink 后失效，须重新授予）：

```bash
sudo setcap cap_net_raw,cap_net_admin+eip target/debug/etherpilot   # 或 just cap
```

禁止 `sudo pnpm tauri dev`（root 会让引擎获得 RT 调度 + 内存锁定，曾导致 ~12GB RSS OOM）。

**实时调度（默认关闭）**：`ECAT_RT_PRIORITY=0`（默认）跳过 `SCHED_FIFO` 与 `mlockall`；`ECAT_RT_PRIORITY=80` 启用，需额外 `cap_sys_nice,cap_ipc_lock`。

## 代码约定与常见模式

- **错误处理（Rust）**：`thiserror` 定义 `EthercatError`（`crates/ethercat/src/error.rs`），提供稳定机器码 `code()`（如 `permission_denied`、`no_slaves`、`already_running`）。Tauri 层统一转成 `IpcError { code, message }`（`src-tauri/src/error.rs`，`camelCase`）。
- **IPC 命名**：命令名 `snake_case`（`list_adapters`、`start_master`、`stop_master`、`get_snapshot`，以及 SDO/OD/PDO 与恢复类 `sdo_read`、`sdo_write`、`read_od_list`、`read_od_entry`、`read_pdo_map`、`write_pdo_map`、`ack_slave_error`、`recover_slave`、`rebuild_bus`、`set_slave_outputs`、`set_auto_recover`、`set_process_data_capture`），参数名前端传 `camelCase`（Tauri 自动映射，如 `cycleUs` → `cycle_us`）。事件名带前缀 `ecat:`。
- **序列化**：结构体 `#[serde(rename_all = "camelCase")]`，枚举 `snake_case`（`EngineState`、`AlState`）；带标签枚举用 `#[serde(tag = "kind")]`（`EngineEvent`）。
- **前端状态**：zustand，单 store `useMasterStore`；服务端状态只读，本地仅存选择项与环形历史。错误统一经 `fail()` 处理：`permission_denied` 弹带 `setcap` 提示的 toast。
- **异步（前端）**：`invoke` 返回 Promise；订阅在 `App.tsx` 的 `useEffect` 中挂载并在卸载时 `dispose`。
- **FFI 安全**：所有 `soem_sys::*` 调用都在 `unsafe` 块内，附 `// SAFETY:` 注释。`context_new()` 返回 `Box<ecx_contextt>` —— 上下文与 IOmap **必须存活且不可移动**直到 `ecx_close` 返回；`char[N]` 字段一律复制为 owned `String`，不保留指针。
- **RT 线程**：`rt::promote_current_thread` / `lock_memory` 只做 best-effort；`mlockall` 只用 `MCL_CURRENT`（切勿 `MCL_FUTURE`）。
- **注释风格**：解释 *为什么*（约束、坑），而非 *做什么*。
- **导入别名**：`@/*` → `src/*`（Vite + tsconfig）。TS 严格模式，含 `noUnusedLocals`/`noUnusedParameters`。

## 测试与 QA

- 框架：Rust 内置 `cargo test`。**无前端测试框架**（无 vitest/jest），前端通过构建 + 手动运行验证。
- 位置：单元测试内联于 `crates/ethercat/src/master.rs`（`mod tests`，覆盖 `map_slaves` 与 `snapshot`）；集成测试 `crates/ethercat/tests/adapters.rs`（断言至少枚举到 loopback 网卡，验证 FFI 链接可用）。无 `src-tauri` 测试。
- 运行：`just test`（等价 `cargo test --workspace`）；全量门禁 `just ci`。
- 覆盖率：未配置覆盖率工具。
- CI：`.github/workflows/ci.yml`，ubuntu-24.04 + `cachix/install-nix-action`，递归 checkout 子模块后执行 `nix develop --command just ci`。
- Lint/格式化：`cargo fmt` + `cargo clippy -D warnings`（Rust），`nixfmt`（Nix）。**无** eslint/prettier/biome —— 前端依赖 `tsc -b` 与 Clippy 把关。

## 重要文件

- 入口：`src/main.tsx`（React）、`src-tauri/src/main.rs` → `lib.rs::run()`（Tauri）。
- 核心引擎：`crates/ethercat/src/master.rs`（线程 + 循环 + 状态迁移）、`types.rs`（IPC 契约）。
- 配置：`src-tauri/tauri.conf.json`、`vite.config.ts`、`components.json`（shadcn，base-nova/style，别名指向 `@/components`）、`tsconfig*.json`、`flake.nix`、`.cargo/config.toml`。
- CI/构建：`.github/workflows/ci.yml`、`justfile`、`crates/soem-sys/build.rs`。
