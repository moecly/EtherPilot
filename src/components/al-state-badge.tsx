import { Badge } from "@/components/ui/badge";
import type { AlState, SlaveInfo } from "@/lib/types";

const AL_STATE: Record<AlState, { label: string; className: string }> = {
  init: { label: "INIT", className: "bg-muted text-muted-foreground" },
  pre_op: {
    label: "PRE-OP",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  boot: {
    label: "BOOT",
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  safe_op: {
    label: "SAFE-OP",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  operational: {
    label: "OP",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  unknown: { label: "?", className: "bg-muted text-muted-foreground" },
};

export function AlStateBadge({ slave }: { slave: SlaveInfo }) {
  const { label, className } = AL_STATE[slave.alState];
  return (
    <Badge
      variant="outline"
      className={
        slave.alStateError ? "bg-destructive/15 text-destructive" : className
      }
    >
      {label}
      {slave.alStateError ? " !" : ""}
    </Badge>
  );
}
