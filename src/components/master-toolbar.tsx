import { useState } from "react";
import { CableIcon, RotateCcwIcon, UnplugIcon } from "lucide-react";

import { AdapterSelect } from "@/components/adapter-select";
import { CyclePresetSelect } from "@/components/cycle-preset-select";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMasterStore } from "@/store/master";

export function MasterToolbar() {
  const status = useMasterStore((s) => s.status);
  const hasIface = useMasterStore((s) => s.selectedIface !== null);
  const connect = useMasterStore((s) => s.connect);
  const disconnect = useMasterStore((s) => s.disconnect);
  const autoRecover = useMasterStore((s) => s.autoRecover);
  const setAutoRecover = useMasterStore((s) => s.setAutoRecover);
  const ackError = useMasterStore((s) => s.ackError);
  const rebuildBus = useMasterStore((s) => s.rebuildBus);
  const busy = useMasterStore((s) => s.busy);

  const [confirmReset, setConfirmReset] = useState(false);

  const starting = status === "starting";
  const running = status === "running" || status === "rebuilding";

  const onReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    void rebuildBus();
  };

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
      <Button
        variant="outline"
        size="sm"
        disabled={!running || busy.ack}
        onClick={() => void ackError(0)}
      >
        Ack all
      </Button>
      <Button
        variant={confirmReset ? "destructive" : "outline"}
        size="sm"
        disabled={!running || busy.rebuild}
        onClick={onReset}
      >
        <RotateCcwIcon /> {confirmReset ? "Confirm reset?" : "Reset bus"}
      </Button>
      <div className="flex items-center gap-2">
        <Switch
          id="auto-recover"
          checked={autoRecover}
          onCheckedChange={(v) => void setAutoRecover(v)}
        />
        <Label htmlFor="auto-recover" className="text-xs">
          Auto-recover
        </Label>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <StatusBadge state={status} />
        <ThemeToggle />
      </div>
    </header>
  );
}
