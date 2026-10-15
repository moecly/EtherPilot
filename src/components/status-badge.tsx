import { Badge } from "@/components/ui/badge";
import type { EngineState } from "@/lib/types";

const STATUS: Record<EngineState, { label: string; className: string }> = {
  idle: { label: "idle", className: "bg-muted text-muted-foreground" },
  starting: {
    label: "starting",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  running: {
    label: "running",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "failed", className: "bg-destructive/15 text-destructive" },
  stopped: { label: "stopped", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ state }: { state: EngineState }) {
  const { label, className } = STATUS[state];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
