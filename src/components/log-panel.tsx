import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/types";
import { useMasterStore } from "@/store/master";

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

export function LogPanel() {
  const logs = useMasterStore((s) => s.logs);
  const host = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const node = host.current;
    if (node && stick.current) node.scrollTop = node.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={host}
      onScroll={() => {
        const node = host.current;
        if (node) {
          stick.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 24;
        }
      }}
      className="font-mono text-xs overflow-auto"
    >
      {logs.length === 0 ? (
        <p className="text-muted-foreground p-3">No log entries.</p>
      ) : (
        logs.map((log, index) => (
          <div
            key={index}
            className={cn("px-3 py-0.5", LEVEL_CLASS[log.level])}
          >
            <span className="text-muted-foreground">
              {new Date(log.atUs / 1000).toLocaleTimeString()}{" "}
            </span>
            {log.message}
          </div>
        ))
      )}
    </div>
  );
}
