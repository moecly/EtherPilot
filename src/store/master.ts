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
} from "@/lib/types";

/** Number of samples retained in the cycle-time ring; 600 @ 10 Hz = 60 s on screen. */
const HISTORY_CAP = 600;
const LOG_CAP = 500;

export const CYCLE_PRESETS = [250, 500, 1000, 2000, 4000] as const;

interface CycleHistory {
  t: number[];
  cycle: number[];
  jitter: number[];
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

  return {
    adapters: [],
    selectedIface: null,
    cycleUs: 1000,
    status: "idle",
    snapshot: null,
    logs: [],
    error: null,
    cycleHistory: { t: [], cycle: [], jitter: [] },

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
        set({ status: "idle" });
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
            return {
              snapshot,
              status: snapshot.state,
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
          set({ status: "idle" });
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
  };
});
