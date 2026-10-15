// Manual mirror of `crates/ethercat/src/types.rs`. This is the IPC contract: keep field names and
// casing in sync with the Rust serde output.

export interface Adapter {
  name: string;
  desc: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface EngineLog {
  atUs: number;
  level: LogLevel;
  message: string;
}

export type EngineState = "idle" | "starting" | "running" | "failed" | "stopped";

export type AlState =
  | "init"
  | "pre_op"
  | "boot"
  | "safe_op"
  | "operational"
  | "unknown";

export interface SlaveInfo {
  position: number;
  name: string;
  configAddr: number;
  alias: number;
  vendorId: number;
  productCode: number;
  revision: number;
  serial: number;
  alStateRaw: number;
  alState: AlState;
  alStateError: boolean;
  alStatusCode: number;
  alStatusText: string;
  inputBits: number;
  outputBits: number;
  inputBytes: number;
  outputBytes: number;
  hasDc: boolean;
  isLost: boolean;
  topology: number;
  activePorts: number;
  group: number;
  parent: number;
  parentPort: number;
  entryPort: number;
}

export interface CycleStats {
  cycleIndex: number;
  wkc: number;
  expectedWkc: number;
  wkcOk: boolean;
  cycleTimeUs: number;
  jitterUs: number;
  dcTimeNs: number;
  lostFrames: number;
  minCycleUs: number;
  maxCycleUs: number;
  avgCycleUs: number;
}

export interface MasterSnapshot {
  state: EngineState;
  iface: string | null;
  cycleUs: number;
  slaveCount: number;
  group0InputBytes: number;
  group0OutputBytes: number;
  segments: number;
  slaves: SlaveInfo[];
  cycle: CycleStats;
  updatedAtUs: number;
}

export interface IpcError {
  code: string;
  message: string;
}
