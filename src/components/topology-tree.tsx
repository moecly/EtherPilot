import { AlStateBadge } from "@/components/al-state-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SlaveInfo } from "@/lib/types";
import { useMasterStore } from "@/store/master";

function buildChildren(slaves: SlaveInfo[]): Map<number, SlaveInfo[]> {
  const children = new Map<number, SlaveInfo[]>();
  for (const slave of slaves) {
    const siblings = children.get(slave.parent) ?? [];
    siblings.push(slave);
    children.set(slave.parent, siblings);
  }
  return children;
}

function TopologyNode({
  slave,
  children,
  depth,
}: {
  slave: SlaveInfo;
  children: Map<number, SlaveInfo[]>;
  depth: number;
}) {
  const kids = children.get(slave.position) ?? [];
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        <span className="font-mono text-xs">{slave.name}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {slave.alias > 0 ? slave.alias : "\u2014"} | {slave.position}
        </span>
        <AlStateBadge slave={slave} />
        {slave.isLost && (
          <span className="text-destructive text-xs font-medium">lost</span>
        )}
      </div>
      {kids.map((kid) => (
        <TopologyNode
          key={kid.position}
          slave={kid}
          children={children}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function TopologyTree() {
  const snapshot = useMasterStore((s) => s.snapshot);
  const selectedIface = useMasterStore((s) => s.selectedIface);
  const slaves = snapshot?.slaves ?? [];
  const iface = snapshot?.iface ?? selectedIface;

  if (slaves.length === 0) {
    return (
      <p className="text-muted-foreground p-3 text-xs">
        No slaves discovered. Connect to an adapter to enumerate the bus.
      </p>
    );
  }

  const children = buildChildren(slaves);
  const roots = children.get(0) ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="font-mono text-xs font-semibold">
            {iface ?? "master"}
          </span>
          <span className="text-muted-foreground text-xs">slave 0</span>
        </div>
        {roots.map((slave) => (
          <TopologyNode
            key={slave.position}
            slave={slave}
            children={children}
            depth={1}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
