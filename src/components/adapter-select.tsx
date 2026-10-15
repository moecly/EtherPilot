import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMasterStore } from "@/store/master";

export function AdapterSelect() {
  const adapters = useMasterStore((s) => s.adapters);
  const selectedIface = useMasterStore((s) => s.selectedIface);
  const setIface = useMasterStore((s) => s.setIface);
  const busy = useMasterStore(
    (s) => s.status === "starting" || s.status === "running",
  );

  return (
    <Select
      value={selectedIface}
      onValueChange={(value) => {
        if (typeof value === "string") setIface(value);
      }}
      disabled={busy}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Select network adapter" />
      </SelectTrigger>
      <SelectContent>
        {adapters.map((adapter) => (
          <SelectItem key={adapter.name} value={adapter.name}>
            <span className="font-mono">{adapter.name}</span>
            <span className="text-muted-foreground text-xs">{adapter.desc}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
