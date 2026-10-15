import { CableIcon, UnplugIcon } from "lucide-react";

import { AdapterSelect } from "@/components/adapter-select";
import { CyclePresetSelect } from "@/components/cycle-preset-select";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useMasterStore } from "@/store/master";

export function MasterToolbar() {
  const status = useMasterStore((s) => s.status);
  const hasIface = useMasterStore((s) => s.selectedIface !== null);
  const connect = useMasterStore((s) => s.connect);
  const disconnect = useMasterStore((s) => s.disconnect);

  const starting = status === "starting";
  const running = status === "running";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <span className="font-heading text-sm font-semibold">EtherPilot</span>
      <AdapterSelect />
      <CyclePresetSelect />
      <Button
        variant="default"
        size="sm"
        disabled={!hasIface || starting || running}
        onClick={() => void connect()}
      >
        <CableIcon /> Connect
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!running}
        onClick={() => void disconnect()}
      >
        <UnplugIcon /> Disconnect
      </Button>
      <div className="ml-auto flex items-center gap-3">
        <StatusBadge state={status} />
        <ThemeToggle />
      </div>
    </header>
  );
}
