// The only module that touches `@tauri-apps/api`; everything else depends on this typed surface.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  Adapter,
  EngineLog,
  MasterSnapshot,
  OdEntry,
  OdList,
  PdoMap,
  PdoMapUpdate,
  SdoValue,
  ValueFormat,
} from "@/lib/types";

export const listAdapters = () => invoke<Adapter[]>("list_adapters");

export const startMaster = (ifname: string, cycleUs: number) =>
  invoke<void>("start_master", { ifname, cycleUs });

export const stopMaster = () => invoke<void>("stop_master");

export const getSnapshot = () => invoke<MasterSnapshot>("get_snapshot");

export const sdoRead = (
  slave: number,
  index: number,
  subindex: number,
  completeAccess: boolean,
) => invoke<SdoValue>("sdo_read", { slave, index, subindex, completeAccess });

export const sdoWrite = (
  slave: number,
  index: number,
  subindex: number,
  completeAccess: boolean,
  dataType: number | null,
  format: ValueFormat,
  value: string,
) =>
  invoke<SdoValue>("sdo_write", {
    slave,
    index,
    subindex,
    completeAccess,
    dataType,
    format,
    value,
  });

export const readOdList = (slave: number) =>
  invoke<OdList>("read_od_list", { slave });

export const readOdEntry = (slave: number, index: number, firstSubindex: number) =>
  invoke<OdEntry>("read_od_entry", { slave, index, firstSubindex });

export const readPdoMap = (slave: number) =>
  invoke<PdoMap>("read_pdo_map", { slave });

export const writePdoMap = (slave: number, update: PdoMapUpdate) =>
  invoke<PdoMap>("write_pdo_map", { slave, update });

export const ackSlaveError = (slave: number) =>
  invoke<void>("ack_slave_error", { slave });

export const recoverSlave = (slave: number) =>
  invoke<void>("recover_slave", { slave });

export const rebuildBus = () => invoke<void>("rebuild_bus");

export const setSlaveOutputs = (slave: number, dataHex: string) =>
  invoke<void>("set_slave_outputs", { slave, dataHex });

export const setAutoRecover = (enabled: boolean) =>
  invoke<void>("set_auto_recover", { enabled });

export const setProcessDataCapture = (enabled: boolean) =>
  invoke<void>("set_process_data_capture", { enabled });

export const onSnapshot = (
  cb: (snapshot: MasterSnapshot) => void,
): Promise<UnlistenFn> =>
  listen<MasterSnapshot>("ecat:snapshot", (event) => cb(event.payload));

export const onLog = (cb: (log: EngineLog) => void): Promise<UnlistenFn> =>
  listen<EngineLog>("ecat:log", (event) => cb(event.payload));

export const onStopped = (cb: (reason: string) => void): Promise<UnlistenFn> =>
  listen<{ reason: string }>("ecat:stopped", (event) => cb(event.payload.reason));
