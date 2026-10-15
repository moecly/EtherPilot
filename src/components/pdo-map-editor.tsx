import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hex16 } from "@/lib/format";
import type { PdoMap } from "@/lib/types";
import { useMasterStore } from "@/store/master";

function parseIndex(text: string): number | null {
  const t = text.trim().replace(/^0x/i, "");
  if (!t) return null;
  const v = Number.parseInt(t, 16);
  return Number.isNaN(v) ? null : v;
}

/** "0x1600 0x1601" or "1600,1601" -> [0x1600, 0x1601]. */
function parseIndexList(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(parseIndex)
    .filter((v): v is number => v !== null);
}

/** "0x6000:01:16" -> 0x60000110; "0:0:0" (filler) -> 0. Throws on malformed input. */
function parseEntryToken(token: string): number {
  const [i, s, b] = token.replace(/^0x/i, "").split(":");
  const index = Number.parseInt(i, 16);
  const sub = Number.parseInt(s, 16);
  const bits = Number.parseInt(b, 16);
  if (
    Number.isNaN(index) ||
    Number.isNaN(sub) ||
    Number.isNaN(bits) ||
    index < 0 ||
    index > 0xffff ||
    sub < 0 ||
    sub > 0xff ||
    bits < 0 ||
    bits > 0xff
  ) {
    throw new Error(`invalid entry '${token}'`);
  }
  return ((index << 16) | (sub << 8) | bits) >>> 0;
}

function formatEntry(value: number): string {
  const index = (value >>> 16) & 0xffff;
  const sub = (value >>> 8) & 0xff;
  const bits = value & 0xff;
  return index === 0 && sub === 0 ? "0:0:0" : `0x${index.toString(16).padStart(4, "0")}:${sub}:${bits}`;
}

export function PdoMapEditor({ slave }: { slave: number }) {
  const pdoMap = useMasterStore((s) => s.pdoMap);
  const pdoLoading = useMasterStore((s) => s.pdoLoading);
  const pdoMapError = useMasterStore((s) => s.pdoMapError);
  const loadPdoMap = useMasterStore((s) => s.loadPdoMap);
  const applyPdoMap = useMasterStore((s) => s.applyPdoMap);
  const busy = useMasterStore((s) => s.busy);
  const status = useMasterStore((s) => s.status);
  const od = useMasterStore((s) => s.od);

  const [rxText, setRxText] = useState("");
  const [txText, setTxText] = useState("");
  const [mappingText, setMappingText] = useState<Record<number, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void loadPdoMap(slave);
  }, [slave, loadPdoMap]);

  useEffect(() => {
    if (!pdoMap) return;
    const maps: Record<number, string> = {};
    let rx = "";
    let tx = "";
    for (const a of pdoMap.assignments) {
      const indices = a.pdos.map((p) => `0x${p.index.toString(16)}`);
      if (a.direction === "rx") rx = indices.join(" ");
      else tx = indices.join(" ");
      for (const p of a.pdos) {
        maps[p.index] = p.entries.map((e) => formatEntry(
          ((e.index << 16) | (e.subindex << 8) | e.bitLength) >>> 0,
        )).join(" ");
      }
    }
    setRxText(rx);
    setTxText(tx);
    setMappingText(maps);
  }, [pdoMap]);

  const nameFor = (index: number) =>
    od?.find((e) => e.index === index)?.name ?? "";

  const apply = async () => {
    try {
      const mappings = Object.entries(mappingText).map(([idx, txt]) => ({
        index: Number(idx),
        entries: txt
          .split(/\s+/)
          .filter(Boolean)
          .map(parseEntryToken),
      }));
      setEditError(null);
      await applyPdoMap(slave, {
        rx: parseIndexList(rxText),
        tx: parseIndexList(txText),
        mappings,
      });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e));
    }
  };

  const onApplyClick = () => {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    void apply();
  };

  if (pdoLoading && !pdoMap) {
    return <p className="text-muted-foreground text-xs">Loading{"\u2026"}</p>;
  }
  if (pdoMapError) {
    return <p className="text-destructive text-xs">{pdoMapError.message}</p>;
  }
  if (!pdoMap) {
    return <p className="text-muted-foreground text-xs">No PDO mapping available.</p>;
  }

  const rebuilding = busy.rebuild || status === "rebuilding";

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 pr-3">
        <PdoReadout map={pdoMap} nameFor={nameFor} />

        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-sm font-medium">Edit &amp; remap</span>
          <div className="grid gap-1">
            <Label className="text-xs">Rx assignment (0x1C12)</Label>
            <Input
              className="font-mono"
              value={rxText}
              placeholder="0x1600 0x1601"
              onChange={(e) => setRxText(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Tx assignment (0x1C13)</Label>
            <Input
              className="font-mono"
              value={txText}
              placeholder="0x1A00 0x1A01"
              onChange={(e) => setTxText(e.target.value)}
            />
          </div>
          {Object.entries(mappingText).map(([idx, txt]) => (
            <div key={idx} className="grid gap-1">
              <Label className="text-xs font-mono">
                0x{Number(idx).toString(16)} entries
              </Label>
              <Input
                className="font-mono"
                value={txt}
                placeholder="0x6000:01:16 0:0:0"
                onChange={(e) =>
                  setMappingText((prev) => ({ ...prev, [Number(idx)]: e.target.value }))
                }
              />
            </div>
          ))}
          {editError && <p className="text-destructive text-xs">{editError}</p>}
          <div className="flex items-center gap-2">
            <Button
              variant={confirming ? "destructive" : "default"}
              size="sm"
              disabled={rebuilding}
              onClick={onApplyClick}
            >
              {confirming ? "Confirm rebuild bus?" : "Apply"}
            </Button>
            {rebuilding && (
              <span className="text-muted-foreground text-xs">Rebuilding{"\u2026"}</span>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function PdoReadout({
  map,
  nameFor,
}: {
  map: PdoMap;
  nameFor: (index: number) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-6 text-xs">
        <span>
          Output bits: <span className="font-mono">{map.outputBits}</span>
        </span>
        <span>
          Input bits: <span className="font-mono">{map.inputBits}</span>
        </span>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
          Sync managers
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">SM</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Length</TableHead>
              <TableHead>Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {map.syncManagers.map((sm) => (
              <TableRow key={sm.sm}>
                <TableCell>{sm.sm}</TableCell>
                <TableCell>{sm.smType}</TableCell>
                <TableCell className="font-mono">{hex16(sm.startAddr)}</TableCell>
                <TableCell className="font-mono">{sm.lengthBytes}</TableCell>
                <TableCell>{sm.enabled ? "yes" : "no"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {map.assignments.map((a) => (
        <div key={a.assignIndex}>
          <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
            {a.direction === "rx" ? "Rx (outputs)" : "Tx (inputs)"} {"\u2014"}{" "}
            {hex16(a.assignIndex)}
          </div>
          {a.pdos.length === 0 && (
            <p className="text-muted-foreground text-xs">none</p>
          )}
          {a.pdos.map((pdo) => (
            <div key={pdo.index} className="mb-1">
              <span className="font-mono text-xs font-medium">{hex16(pdo.index)}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {nameFor(pdo.index)}
              </span>
              <ul className="ml-4 font-mono text-xs">
                {pdo.entries.map((e, i) => (
                  <li key={i}>
                    {e.filler
                      ? "filler"
                      : `${hex16(e.index)}:${e.subindex} (${e.bitLength} bits)`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
