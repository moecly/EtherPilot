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

export type EngineState =
  | "idle"
  | "starting"
  | "running"
  | "rebuilding"
  | "failed"
  | "stopped";

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
  outputStartBit: number;
  inputStartBit: number;
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

export interface BusHealth {
  lost: number;
  acks: number;
  recovers: number;
  reconfigs: number;
  lastPassUs: number;
  autoRecover: boolean;
}

export interface SlaveProcessData {
  position: number;
  outputsHex: string;
  inputsHex: string;
  outputStartBit: number;
  inputStartBit: number;
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
  processData: SlaveProcessData[];
  cycle: CycleStats;
  busHealth: BusHealth;
  updatedAtUs: number;
}

export interface IpcError {
  code: string;
  message: string;
}

// ---- SDO / OD ----

export interface SdoValue {
  slave: number;
  index: number;
  subindex: number;
  size: number;
  hex: string;
  display: string;
  dataType: number;
  bitLength: number;
  writable: boolean;
}

export type ValueFormat = "dec" | "hex" | "text" | "bool";

export interface OdListEntry {
  index: number;
  dataType: number;
  objectCode: number;
  maxSub: number;
  name: string;
}

export interface OdList {
  slave: number;
  entries: OdListEntry[];
}

export interface OdSubEntry {
  subindex: number;
  dataType: number;
  bitLength: number;
  objAccess: number;
  name: string;
  hasValue: boolean;
}

export interface OdEntry {
  slave: number;
  index: number;
  dataType: number;
  objectCode: number;
  maxSub: number;
  name: string;
  subindices: OdSubEntry[];
  truncated: boolean;
  nextSubindex: number;
}

// ---- PDO ----

export type PdoDirection = "rx" | "tx";

export interface SmInfo {
  sm: number;
  smType: number;
  startAddr: number;
  lengthBytes: number;
  enabled: boolean;
}

export interface PdoEntry {
  index: number;
  subindex: number;
  bitLength: number;
  filler: boolean;
}

export interface Pdo {
  index: number;
  entries: PdoEntry[];
}

export interface PdoAssignment {
  assignIndex: number;
  direction: PdoDirection;
  pdos: Pdo[];
}

export interface PdoMap {
  slave: number;
  rxAssignIndex: number;
  txAssignIndex: number;
  assignments: PdoAssignment[];
  syncManagers: SmInfo[];
  outputBits: number;
  inputBits: number;
  truncated: boolean;
  nextPdo: number;
}

export interface PdoMappingUpdate {
  index: number;
  entries: number[];
}

export interface PdoMapUpdate {
  rx: number[];
  tx: number[];
  mappings: PdoMappingUpdate[];
}
