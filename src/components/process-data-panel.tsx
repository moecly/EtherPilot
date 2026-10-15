import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMasterStore } from "@/store/master";

function toBytes(hex: string): string[] {
  return hex.match(/../g) ?? [];
}

export function ProcessDataPanel({ slave }: { slave: number }) {
  const data = useMasterStore((s) =>
    s.snapshot?.processData.find((p) => p.position === slave),
  );
  const setCapture = useMasterStore((s) => s.setProcessDataCapture);
  const writeOutputs = useMasterStore((s) => s.writeSlaveOutputs);

  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prevInputs = useRef<string[]>([]);

  // Capture is only needed while this tab is mounted.
  useEffect(() => {
    void setCapture(true);
    return () => {
      void setCapture(false);
    };
  }, [setCapture]);

  // Seed the editable outputs once the first sample for this slave arrives.
  useEffect(() => {
    if (data && outputs.length === 0) {
      setOutputs(toBytes(data.outputsHex));
    }
  }, [data, outputs.length]);

  useEffect(() => {
    setOutputs([]);
  }, [slave]);

  const inputs = useMemo(() => toBytes(data?.inputsHex ?? ""), [data?.inputsHex]);
  useEffect(() => {
    prevInputs.current = inputs;
  }, [inputs]);

  const setByte = (i: number, value: string) => {
    const v = value.replace(/[^0-9a-fA-F]/g, "").slice(-2);
    setOutputs((prev) => prev.map((b, j) => (j === i ? v : b)));
  };

  const write = async (bytes: string[]) => {
    const hex = bytes.map((b) => b.padStart(2, "0")).join("");
    if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length !== bytes.length * 2) {
      setError("Invalid hex byte");
      return;
    }
    setError(null);
    await writeOutputs(slave, hex);
  };

  if (!data) {
    return (
      <p className="text-muted-foreground text-xs">
        Waiting for a process-data sample{"\u2026"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          Outputs {"\u2014"} first bit {data.outputStartBit} of byte 0
        </div>
        {outputs.length === 0 ? (
          <p className="text-muted-foreground text-xs">No output bytes.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {outputs.map((b, i) => (
                <Input
                  key={i}
                  className="h-7 w-9 px-1 text-center font-mono text-xs"
                  value={b}
                  maxLength={2}
                  onChange={(e) => setByte(i, e.target.value)}
                />
              ))}
            </div>
            {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void write(outputs)}>
                Write outputs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const zeroed = outputs.map(() => "00");
                  setOutputs(zeroed);
                  void write(zeroed);
                }}
              >
                Zero outputs
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="border-t pt-3">
        <div className="text-muted-foreground mb-1 text-xs">
          Inputs {"\u2014"} first bit {data.inputStartBit} of byte 0
        </div>
        {inputs.length === 0 ? (
          <p className="text-muted-foreground text-xs">No input bytes.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {inputs.map((b, i) => (
              <span
                key={i}
                className={`w-9 rounded border px-1 py-1 text-center font-mono text-xs ${
                  prevInputs.current[i] && prevInputs.current[i] !== b
                    ? "border-primary text-primary"
                    : "border-input"
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      <Label className="text-muted-foreground text-xs">
        Output writes apply on the next process-data cycle.
      </Label>
    </div>
  );
}
