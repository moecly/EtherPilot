import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hex16 } from "@/lib/format";
import type { SdoValue, ValueFormat } from "@/lib/types";
import { useMasterStore } from "@/store/master";

/** Parse "0x1000", "1000" or "4096" as a hex index. */
function parseIndex(text: string): number | null {
  const t = text.trim().replace(/^0x/i, "");
  if (t.length === 0) return null;
  const v = Number.parseInt(t, 16);
  return Number.isNaN(v) ? null : v;
}

function parseSubindex(text: string): number | null {
  const v = Number.parseInt(text.trim(), 10);
  return Number.isNaN(v) || v < 0 || v > 255 ? null : v;
}

/** SDO Info entry access bits: 0x01 readable, 0x02 writable (ETG.1000.6). */
function accessLabel(objAccess: number): string {
  const read = (objAccess & 0x01) !== 0;
  const write = (objAccess & 0x02) !== 0;
  if (read && write) return "rw";
  if (read) return "ro";
  if (write) return "wo";
  return "\u2014";
}

function Row({
  slave,
  index,
  subindex,
  name,
  dataType,
  bitLength,
  objAccess,
  selected,
  onSelect,
  value,
}: {
  slave: number;
  index: number;
  subindex: number;
  name: string;
  dataType: number;
  bitLength: number;
  objAccess: number;
  selected: boolean;
  onSelect(): void;
  value?: SdoValue;
}) {
  const sdoRead = useMasterStore((s) => s.sdoRead);
  const [reading, setReading] = useState(false);

  const read = async () => {
    setReading(true);
    try {
      await sdoRead(slave, index, subindex, false);
    } catch {
      /* reported by the store */
    } finally {
      setReading(false);
    }
  };

  return (
    <TableRow
      className={selected ? "bg-muted/60" : undefined}
      onClick={onSelect}
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="text-right">{subindex}</TableCell>
      <TableCell className="font-sans">{name || "\u2014"}</TableCell>
      <TableCell>{hex16(dataType)}</TableCell>
      <TableCell className="text-right">{bitLength}</TableCell>
      <TableCell>{accessLabel(objAccess)}</TableCell>
      <TableCell className="max-w-[220px] truncate" title={value?.display}>
        {value ? value.display : "\u2014"}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={reading}
          onClick={(e) => {
            e.stopPropagation();
            void read();
          }}
        >
          R
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SdoEditor({ slave }: { slave: number }) {
  const od = useMasterStore((s) => s.od);
  const odLoading = useMasterStore((s) => s.odLoading);
  const odError = useMasterStore((s) => s.odError);
  const odEntry = useMasterStore((s) => s.odEntry);
  const loadOd = useMasterStore((s) => s.loadOd);
  const loadOdEntry = useMasterStore((s) => s.loadOdEntry);
  const sdoRead = useMasterStore((s) => s.sdoRead);
  const sdoWrite = useMasterStore((s) => s.sdoWrite);
  const busy = useMasterStore((s) => s.busy);

  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, SdoValue>>({});
  const [format, setFormat] = useState<ValueFormat>("dec");
  const [draft, setDraft] = useState("");

  // Raw row.
  const [rawIndex, setRawIndex] = useState("1000");
  const [rawSub, setRawSub] = useState("0");
  const [rawValue, setRawValue] = useState("");
  const [rawAccess, setRawAccess] = useState(false);

  useEffect(() => {
    setSelectedIndex(null);
    setSelectedSub(null);
    setValues({});
    void loadOd(slave);
  }, [slave, loadOd]);

  const filtered = useMemo(() => {
    if (!od) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return od;
    return od.filter(
      (e) =>
        hex16(e.index).toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q),
    );
  }, [od, filter]);

  const selectIndex = async (index: number) => {
    setSelectedIndex(index);
    setSelectedSub(0);
    setDraft("");
    setFormat("dec");
    await loadOdEntry(slave, index);
  };

  const key = (index: number, sub: number) => `${index}:${sub}`;

  const readSub = async (index: number, sub: number, completeAccess = false) => {
    try {
      const value = await sdoRead(slave, index, sub, completeAccess);
      setValues((prev) => ({ ...prev, [key(index, sub)]: value }));
      return value;
    } catch {
      return null;
    }
  };

  const selectedValue =
    selectedIndex !== null && selectedSub !== null
      ? values[key(selectedIndex, selectedSub)]
      : undefined;

  // Auto-read the selected subindex so its value is visible before writing.
  useEffect(() => {
    if (selectedIndex !== null && selectedSub !== null) {
      void readSub(selectedIndex, selectedSub);
    }
  }, [selectedIndex, selectedSub]);

  const writeSelected = async () => {
    if (selectedIndex === null || selectedSub === null) return;
    try {
      const result = await sdoWrite(
        slave,
        selectedIndex,
        selectedSub,
        false,
        odEntry?.dataType && odEntry.dataType !== 0 ? null : 0,
        format,
        draft,
      );
      setValues((prev) => ({ ...prev, [key(selectedIndex, selectedSub)]: result }));
      setDraft("");
    } catch {
      /* reported by the store */
    }
  };

  const readRaw = async () => {
    const index = parseIndex(rawIndex);
    const sub = parseSubindex(rawSub);
    if (index === null || sub === null) return;
    const value = await readSub(index, sub, rawAccess);
    if (value) setRawValue(value.hex);
  };

  const writeRaw = async () => {
    const index = parseIndex(rawIndex);
    const sub = parseSubindex(rawSub);
    if (index === null || sub === null) return;
    try {
      await sdoWrite(slave, index, sub, rawAccess, 0, "hex", rawValue);
      void readRaw();
    } catch {
      /* reported by the store */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 gap-3">
        {/* OD list */}
        <div className="flex w-72 shrink-0 flex-col gap-2 border-r pr-3">
          <Input
            placeholder="Filter index or name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {odLoading && <p className="text-muted-foreground text-xs">Loading{"\u2026"}</p>}
          {odError && (
            <p className="text-destructive text-xs">
              {odError.code === "not_supported"
                ? "No SDO Info support; use the raw access below."
                : odError.message}
            </p>
          )}
          <ScrollArea className="min-h-0 flex-1">
            <ul className="text-xs">
              {filtered.map((e) => (
                <li key={e.index}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted ${
                      selectedIndex === e.index ? "bg-muted" : ""
                    }`}
                    onClick={() => void selectIndex(e.index)}
                  >
                    <span className="font-mono">{hex16(e.index)}</span>
                    <span className="truncate text-muted-foreground">{e.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        {/* Subindex table */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {odEntry ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium">{hex16(odEntry.index)}</span>
                <span className="text-muted-foreground">{odEntry.name}</span>
                <span className="text-muted-foreground">
                  type {hex16(odEntry.dataType)} {"\u00b7"} sub 0..{odEntry.maxSub}
                </span>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-10 text-right">Sub</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Bits</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {odEntry.subindices.map((s) => (
                      <Row
                        key={s.subindex}
                        slave={slave}
                        index={odEntry.index}
                        subindex={s.subindex}
                        name={s.name}
                        dataType={s.dataType}
                        bitLength={s.bitLength}
                        objAccess={s.objAccess}
                        selected={selectedSub === s.subindex}
                        onSelect={() => {
                          setSelectedSub(s.subindex);
                          setFormat("dec");
                          setDraft("");
                        }}
                        value={values[key(odEntry.index, s.subindex)]}
                      />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              Select an object to show its subindices.
            </p>
          )}
        </div>
      </div>

      {/* Selected-sub editor */}
      {selectedIndex !== null && selectedSub !== null && (
        <div className="flex items-end gap-2 border-t pt-2">
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">
              Write {hex16(selectedIndex)}:{selectedSub}
            </span>
            <span className="font-mono text-xs" title={selectedValue?.display}>
              {selectedValue ? selectedValue.display : "\u2014"}
            </span>
          </div>
          <div className="ml-2 grid gap-1">
            <Label className="text-xs">Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as ValueFormat)}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dec">Dec</SelectItem>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="bool">Bool</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 grid gap-1">
            <Label className="text-xs">Value</Label>
            <Input
              value={draft}
              placeholder={format === "hex" ? "0A0B0C0D" : "42"}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={busy.sdo} onClick={() => void writeSelected()}>
            Write
          </Button>
        </div>
      )}

      {/* Raw access */}
      <div className="flex items-end gap-2 border-t pt-2">
        <div className="grid gap-1">
          <Label className="text-xs">Index</Label>
          <Input
            className="h-7 w-24 font-mono"
            value={rawIndex}
            onChange={(e) => setRawIndex(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Sub</Label>
          <Input
            className="h-7 w-16 font-mono"
            value={rawSub}
            onChange={(e) => setRawSub(e.target.value)}
          />
        </div>
        <div className="flex-1 grid gap-1">
          <Label className="text-xs">Raw hex {rawAccess ? "(complete access)" : ""}</Label>
          <Input
            className="font-mono"
            value={rawValue}
            placeholder="DEADBEEF"
            onChange={(e) => setRawValue(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setRawAccess((v) => !v)}>
          {rawAccess ? "CA on" : "CA off"}
        </Button>
        <Button variant="outline" size="sm" disabled={busy.sdo} onClick={() => void readRaw()}>
          Read
        </Button>
        <Button size="sm" disabled={busy.sdo} onClick={() => void writeRaw()}>
          Write
        </Button>
      </div>
    </div>
  );
}
