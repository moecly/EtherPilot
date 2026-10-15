import { CYCLE_PRESETS, useMasterStore } from "@/store/master";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CyclePresetSelect() {
  const cycleUs = useMasterStore((s) => s.cycleUs);
  const setCycleUs = useMasterStore((s) => s.setCycleUs);
  const busy = useMasterStore(
    (s) => s.status === "starting" || s.status === "running",
  );

  return (
    <Select
      value={cycleUs}
      onValueChange={(value) => {
        if (typeof value === "number") setCycleUs(value);
      }}
      disabled={busy}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CYCLE_PRESETS.map((preset) => (
          <SelectItem key={preset} value={preset}>
            <span className="font-mono tabular-nums">
              {preset >= 1000 ? `${preset / 1000} ms` : `${preset} us`}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
