import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMasterStore } from "@/store/master";
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card size="sm" className="min-w-[128px] flex-1">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-sm tabular-nums">{value}</CardTitle>
        {detail && (
          <CardDescription className="font-mono tabular-nums">
            {detail}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

export function DiagnosticsStrip() {
  const snapshot = useMasterStore((s) => s.snapshot);
  const autoRecover = useMasterStore((s) => s.autoRecover);
  const cycle = snapshot?.cycle;
  const slaveCount = snapshot?.slaveCount ?? 0;
  const ioBytes =
    (snapshot?.group0OutputBytes ?? 0) + (snapshot?.group0InputBytes ?? 0);
  const bus = snapshot?.busHealth;
  const busLost = bus?.lost ?? 0;

  return (
    <div className="flex flex-wrap items-start gap-2 p-3">
      <Metric
        label="Cycle time"
        value={cycle ? `${cycle.cycleTimeUs} us` : "\u2014"}
        detail={
          cycle
            ? `min ${cycle.minCycleUs} / avg ${cycle.avgCycleUs} / max ${cycle.maxCycleUs}`
            : undefined
        }
      />
      <Metric
        label="Jitter"
        value={cycle ? `${cycle.jitterUs} us` : "\u2014"}
        detail={cycle ? `target ${snapshot?.cycleUs ?? 0} us` : undefined}
      />
      <Metric
        label="WKC"
        value={cycle ? `${cycle.wkc} / ${cycle.expectedWkc}` : "\u2014"}
        detail={cycle?.wkcOk ? "ok" : "short"}
      />
      <Metric
        label="Lost frames"
        value={cycle ? String(cycle.lostFrames) : "\u2014"}
      />
      <Metric
        label="DC time"
        value={cycle ? `${Math.round(cycle.dcTimeNs / 1000).toLocaleString()} us` : "\u2014"}
      />
      <Metric label="Slaves" value={String(slaveCount)} />
      <Metric
        label="Group 0 I/O"
        value={`${ioBytes} B`}
        detail={snapshot ? `${snapshot.segments} segments` : undefined}
      />
      <Metric
        label="Bus lost"
        value={String(busLost)}
        detail={bus ? `acks ${bus.acks} / recovers ${bus.recovers} / reconfigs ${bus.reconfigs}` : undefined}
      />
      <div
        className="flex items-center gap-2 pt-2 text-xs"
        title={autoRecover ? "Auto-recovery is enabled" : "Auto-recovery is disabled"}
      >
        <span
          className={`size-2.5 rounded-full ${
            autoRecover ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
        />
        <span className="text-muted-foreground">Auto-recover</span>
      </div>
    </div>
  );
}
