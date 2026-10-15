import { useEffect, type ReactNode } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { CycleTimeChart } from "@/components/cycle-time-chart";
import { DiagnosticsStrip } from "@/components/diagnostics-strip";
import { LogPanel } from "@/components/log-panel";
import { MasterToolbar } from "@/components/master-toolbar";
import { SlaveDetail } from "@/components/slave-detail";
import { SlaveStateTable } from "@/components/slave-state-table";
import { TopologyTree } from "@/components/topology-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMasterStore } from "@/store/master";

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="text-muted-foreground shrink-0 border-b px-3 py-1 text-xs font-medium uppercase tracking-wide">
        {title}
      </div>
      {children}
    </section>
  );
}

export default function App() {
  useEffect(() => {
    let dispose: UnlistenFn[] = [];
    let cancelled = false;

    void useMasterStore
      .getState()
      .loadAdapters()
      .then(() => useMasterStore.getState().attach())
      .then((unlisten) => {
        if (cancelled) unlisten.forEach((fn) => fn());
        else dispose = unlisten;
      });

    return () => {
      cancelled = true;
      dispose.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col">
      <MasterToolbar />
      <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden">
        <Panel
          title="Topology"
          className="flex min-h-0 flex-col overflow-hidden border-r"
        >
          <ScrollArea className="min-h-0 flex-1">
            <TopologyTree />
          </ScrollArea>
        </Panel>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <DiagnosticsStrip />
          <Panel
            title="Slaves"
            className="flex min-h-0 flex-1 flex-col overflow-hidden border-t"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <SlaveStateTable />
            </div>
          </Panel>
          <Panel
            title="Cycle time / jitter"
            className="flex h-40 shrink-0 flex-col overflow-hidden border-t"
          >
            <div className="min-h-0 flex-1 p-2">
              <CycleTimeChart />
            </div>
          </Panel>
          <Panel
            title="Log"
            className="flex h-40 shrink-0 flex-col overflow-hidden border-t"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <LogPanel />
            </div>
          </Panel>
        </div>
      </div>
      <SlaveDetail />
    </div>
  );
}
