import { create } from "zustand";
import { toast } from "sonner";
import type { UnlistenFn } from "@tauri-apps/api/event";

import * as ipc from "@/lib/ipc";
import type {
  Adapter,
  EngineLog,
  EngineState,
  IpcError,
  MasterSnapshot,
  OdEntry,
  OdListEntry,
  PdoMap,
  PdoMapUpdate,
  SdoValue,
  SlaveProcessData,
  ValueFormat,
} from "@/lib/types";

/** Number of samples retained in the cycle-time ring; 600 @ 10 Hz = 60 s on screen. */
const HISTORY_CAP = 600;
const LOG_CAP = 500;

export const CYCLE_PRESETS = [250, 500, 1000, 2000, 4000] as const;

export type SlaveDetailTab = "overview" | "sdo" | "pdo" | "process";

interface CycleHistory {
  t: number[];
  cycle: number[];
  jitter: number[];
}

interface Busy {
  ack: boolean;
  recover: boolean;
  rebuild: boolean;
  sdo: boolean;
}

interface MasterStore {
  adapters: Adapter[];
  selectedIface: string | null;
  cycleUs: number;
  status: EngineState;
  snapshot: MasterSnapshot | null;
  logs: EngineLog[];
  error: IpcError | null;
  cycleHistory: CycleHistory;
  loadAdapters(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Subscribes to all three engine events; returns the unlisten handles. */
  attach(): Promise<UnlistenFn[]>;
  setIface(name: string): void;
  setCycleUs(us: number): void;

  // Slave detail dialog.
  selectedSlave: number | null;
  slaveDetailTab: SlaveDetailTab;
  openSlave(position: number): void;
  closeSlave(): void;
  setSlaveDetailTab(tab: SlaveDetailTab): void;

  // Bus controls.
  autoRecover: boolean;
  setAutoRecover(on: boolean): Promise<void>;
  ackError(slave: number): Promise<void>;
  recoverSlave(slave: number): Promise<void>;
  rebuildBus(): Promise<void>;

  // SDO / OD editor.
  od: OdListEntry[] | null;
  odLoading: boolean;
  odError: IpcError | null;
  odEntry: OdEntry | null;
  odEntryLoading: boolean;
  loadOd(slave: number): Promise<void>;
  loadOdEntry(slave: number, index: number): Promise<OdEntry | null>;
  sdoRead(
    slave: number,
    index: number,
    subindex: number,
    completeAccess: boolean,
  ): Promise<SdoValue>;
  sdoWrite(
    slave: number,
    index: number,
    subindex: number,
    completeAccess: boolean,
    dataType: number | null,
    format: ValueFormat,
    value: string,
  ): Promise<SdoValue>;

  // PDO editor.
  pdoMap: PdoMap | null;
  pdoLoading: boolean;
  pdoMapError: IpcError | null;
  loadPdoMap(slave: number): Promise<void>;
  applyPdoMap(slave: number, update: PdoMapUpdate): Promise<void>;

  // Process data.
  processData: SlaveProcessData | null;
  setProcessDataCapture(on: boolean): Promise<void>;
  writeSlaveOutputs(slave: number, hex: string): Promise<void>;

  busy: Busy;
}

function normalizeIpcError(error: unknown): IpcError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return error as IpcError;
  }
  if (typeof error === "string") {
    return { code: "internal", message: error };
  }
  return { code: "internal", message: String(error) };
}

function pushRing(values: number[], value: number): void {
  values.push(value);
  if (values.length > HISTORY_CAP) values.splice(0, values.length - HISTORY_CAP);
}

export const useMasterStore = create<MasterStore>((set, get) => {
  const fail = (error: unknown) => {
    const ipcError = normalizeIpcError(error);
    set({ status: "failed", error: ipcError });
    if (ipcError.code === "permission_denied") {
      toast.error(ipcError.message, {
        description:
          "Grant raw-socket access: sudo setcap cap_net_raw,cap_net_admin+eip target/debug/etherpilot",
      });
    } else {
      toast.error(ipcError.message);
    }
  };

  /** Toast a request error without touching the engine status (the snapshot owns it). */
  const report = (error: unknown): IpcError => {
    const ipcError = normalizeIpcError(error);
    toast.error(ipcError.message);
    return ipcError;
  };

  const setBusy = (patch: Partial<Busy>) =>
    set((state) => ({ busy: { ...state.busy, ...patch } }));

  return {
    adapters: [],
    selectedIface: null,
    cycleUs: 1000,
    status: "idle",
    snapshot: null,
    logs: [],
    error: null,
    cycleHistory: { t: [], cycle: [], jitter: [] },

    selectedSlave: null,
    slaveDetailTab: "overview",
    autoRecover: true,
    od: null,
    odLoading: false,
    odError: null,
    odEntry: null,
    odEntryLoading: false,
    pdoMap: null,
    pdoLoading: false,
    pdoMapError: null,
    processData: null,
    busy: { ack: false, recover: false, rebuild: false, sdo: false },

    async loadAdapters() {
      try {
        const adapters = await ipc.listAdapters();
        set({
          adapters,
          selectedIface: get().selectedIface ?? adapters[0]?.name ?? null,
        });
      } catch (error) {
        fail(error);
      }
    },

    async connect() {
      const ifname = get().selectedIface;
      if (!ifname) {
        toast.error("Select a network adapter first");
        return;
      }
      set({ status: "starting", error: null });
      try {
        await ipc.startMaster(ifname, get().cycleUs);
        set({ status: "running" });
      } catch (error) {
        fail(error);
      }
    },

    async disconnect() {
      try {
        await ipc.stopMaster();
        set({ status: "idle", selectedSlave: null, od: null, pdoMap: null });
      } catch (error) {
        fail(error);
      }
    },

    async attach() {
      const unlisten = await Promise.all([
        ipc.onSnapshot((snapshot) => {
          set((state) => {
            const history = state.cycleHistory;
            pushRing(history.t, Date.now() / 1000);
            pushRing(history.cycle, snapshot.cycle.cycleTimeUs);
            pushRing(history.jitter, snapshot.cycle.jitterUs);
            const processData =
              state.selectedSlave === null
                ? state.processData
                : snapshot.processData.find(
                    (p) => p.position === state.selectedSlave,
                  ) ?? null;
            return {
              snapshot,
              status: snapshot.state,
              autoRecover: snapshot.busHealth.autoRecover,
              processData,
              cycleHistory: {
                t: [...history.t],
                cycle: [...history.cycle],
                jitter: [...history.jitter],
              },
            };
          });
        }),
        ipc.onLog((log) => {
          set((state) => {
            const logs = [...state.logs, log];
            if (logs.length > LOG_CAP) logs.splice(0, logs.length - LOG_CAP);
            return { logs };
          });
        }),
        ipc.onStopped((reason) => {
          // The snapshot is the authoritative status; only surface the reason here so a
          // rebuild-failure Stopped cannot race an already-updated `running` snapshot.
          toast.info(`master stopped: ${reason}`);
        }),
      ]);
      return unlisten;
    },

    setIface(name) {
      set({ selectedIface: name });
    },

    setCycleUs(us) {
      set({ cycleUs: us });
    },

    openSlave(position) {
      set({ selectedSlave: position, slaveDetailTab: "overview", odEntry: null });
    },

    closeSlave() {
      set({ selectedSlave: null, od: null, odEntry: null, pdoMap: null });
    },

    setSlaveDetailTab(tab) {
      set({ slaveDetailTab: tab });
    },

    async setAutoRecover(on) {
      try {
        await ipc.setAutoRecover(on);
        set({ autoRecover: on });
      } catch (error) {
        report(error);
      }
    },

    async ackError(slave) {
      setBusy({ ack: true });
      try {
        await ipc.ackSlaveError(slave);
      } catch (error) {
        report(error);
      } finally {
        setBusy({ ack: false });
      }
    },

    async recoverSlave(slave) {
      setBusy({ recover: true });
      try {
        await ipc.recoverSlave(slave);
      } catch (error) {
        report(error);
      } finally {
        setBusy({ recover: false });
      }
    },

    async rebuildBus() {
      setBusy({ rebuild: true });
      try {
        await ipc.rebuildBus();
      } catch (error) {
        report(error);
      } finally {
        setBusy({ rebuild: false });
      }
    },

    async loadOd(slave) {
      set({ odLoading: true, odError: null });
      try {
        const list = await ipc.readOdList(slave);
        set({ od: list.entries, odLoading: false });
      } catch (error) {
        set({ od: null, odLoading: false, odError: normalizeIpcError(error) });
      }
    },

    async loadOdEntry(slave, index) {
      set({ odEntryLoading: true });
      try {
        const first = await ipc.readOdEntry(slave, index, 0);
        const subindices = [...first.subindices];
        let { truncated, nextSubindex } = first;
        while (truncated) {
          const page = await ipc.readOdEntry(slave, index, nextSubindex);
          subindices.push(...page.subindices);
          truncated = page.truncated;
          nextSubindex = page.nextSubindex;
        }
        const entry: OdEntry = { ...first, subindices, truncated: false };
        set({ odEntry: entry, odEntryLoading: false });
        return entry;
      } catch (error) {
        set({ odEntry: null, odEntryLoading: false });
        report(error);
        return null;
      }
    },

    async sdoRead(slave, index, subindex, completeAccess) {
      setBusy({ sdo: true });
      try {
        return await ipc.sdoRead(slave, index, subindex, completeAccess);
      } finally {
        setBusy({ sdo: false });
      }
    },

    async sdoWrite(slave, index, subindex, completeAccess, dataType, format, value) {
      setBusy({ sdo: true });
      try {
        const result = await ipc.sdoWrite(
          slave,
          index,
          subindex,
          completeAccess,
          dataType,
          format,
          value,
        );
        // Refresh the OD entry so the subindex table shows the new value.
        void get().loadOdEntry(slave, index);
        return result;
      } finally {
        setBusy({ sdo: false });
      }
    },

    async loadPdoMap(slave) {
      set({ pdoLoading: true, pdoMapError: null });
      try {
        const map = await ipc.readPdoMap(slave);
        set({ pdoMap: map, pdoLoading: false });
      } catch (error) {
        set({ pdoMap: null, pdoLoading: false, pdoMapError: normalizeIpcError(error) });
      }
    },

    async applyPdoMap(slave, update) {
      setBusy({ rebuild: true });
      set({ pdoMapError: null });
      try {
        const map = await ipc.writePdoMap(slave, update);
        set({ pdoMap: map });
      } catch (error) {
        const ipcError = report(error);
        set({ pdoMapError: ipcError });
      } finally {
        setBusy({ rebuild: false });
      }
    },

    async setProcessDataCapture(on) {
      try {
        await ipc.setProcessDataCapture(on);
        if (!on) set({ processData: null });
      } catch (error) {
        report(error);
      }
    },

    async writeSlaveOutputs(slave, hex) {
      try {
        await ipc.setSlaveOutputs(slave, hex);
      } catch (error) {
        report(error);
      }
    },
  };
});
