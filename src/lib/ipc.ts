// The only module that touches `@tauri-apps/api`; everything else depends on this typed surface.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Adapter, EngineLog, MasterSnapshot } from "@/lib/types";

export const listAdapters = () => invoke<Adapter[]>("list_adapters");

export const startMaster = (ifname: string, cycleUs: number) =>
  invoke<void>("start_master", { ifname, cycleUs });

export const stopMaster = () => invoke<void>("stop_master");

export const getSnapshot = () => invoke<MasterSnapshot>("get_snapshot");

export const onSnapshot = (
  cb: (snapshot: MasterSnapshot) => void,
): Promise<UnlistenFn> =>
  listen<MasterSnapshot>("ecat:snapshot", (event) => cb(event.payload));

export const onLog = (cb: (log: EngineLog) => void): Promise<UnlistenFn> =>
  listen<EngineLog>("ecat:log", (event) => cb(event.payload));

export const onStopped = (cb: (reason: string) => void): Promise<UnlistenFn> =>
  listen<{ reason: string }>("ecat:stopped", (event) => cb(event.payload.reason));
