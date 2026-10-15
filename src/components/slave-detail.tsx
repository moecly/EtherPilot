import { useMasterStore, type SlaveDetailTab } from "@/store/master";
import { AlStateBadge } from "@/components/al-state-badge";
import { PdoMapEditor } from "@/components/pdo-map-editor";
import { ProcessDataPanel } from "@/components/process-data-panel";
import { SdoEditor } from "@/components/sdo-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hex16, hex32 } from "@/lib/format";
import type { SlaveInfo } from "@/lib/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </div>
  );
}

function Overview({ slave }: { slave: SlaveInfo }) {
  const cycle = useMasterStore((s) => s.snapshot?.cycle);
  const busy = useMasterStore((s) => s.busy);
  const ackError = useMasterStore((s) => s.ackError);
  const recoverSlave = useMasterStore((s) => s.recoverSlave);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Position" value={String(slave.position)} />
        <Field label="Name" value={slave.name || "\u2014"} />
        <Field label="Config address" value={hex16(slave.configAddr)} />
        <Field label="Alias" value={hex16(slave.alias)} />
        <Field label="Vendor" value={hex32(slave.vendorId)} />
        <Field label="Product" value={hex32(slave.productCode)} />
        <Field label="Revision" value={hex32(slave.revision)} />
        <Field label="Serial" value={hex32(slave.serial)} />
        <Field label="Topology" value={String(slave.topology)} />
        <Field label="Active ports" value={String(slave.activePorts)} />
        <Field label="Parent" value={`${slave.parent}:${slave.parentPort}`} />
        <Field label="Entry port" value={String(slave.entryPort)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="WKC" value={cycle ? `${cycle.wkc} / ${cycle.expectedWkc}` : "\u2014"} />
        <Field label="Cycle time" value={cycle ? `${cycle.cycleTimeUs} us` : "\u2014"} />
        <Field label="I/O bytes" value={`${slave.outputBytes}O / ${slave.inputBytes}I`} />
        <Field
          label="AL status"
          value={`${hex16(slave.alStatusCode)} ${slave.alStatusText}`}
        />
        <Field label="Distributed clocks" value={slave.hasDc ? "yes" : "no"} />
        <Field label="Lost" value={slave.isLost ? "yes" : "no"} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">State</span>
        <AlStateBadge slave={slave} />
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy.ack}
            onClick={() => void ackError(slave.position)}
          >
            Ack error
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy.recover}
            onClick={() => void recoverSlave(slave.position)}
          >
            Recover
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SlaveDetail() {
  const selected = useMasterStore((s) => s.selectedSlave);
  const tab = useMasterStore((s) => s.slaveDetailTab);
  const setTab = useMasterStore((s) => s.setSlaveDetailTab);
  const close = useMasterStore((s) => s.closeSlave);
  const slave = useMasterStore((s) =>
    s.snapshot?.slaves.find((x) => x.position === s.selectedSlave),
  );

  if (selected === null || !slave) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Slave {slave.position}
            {slave.name ? ` \u2014 ${slave.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Object dictionary, PDO mapping and process data.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SlaveDetailTab)}
          className="min-h-0 flex-1"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sdo">SDO</TabsTrigger>
            <TabsTrigger value="pdo">PDO</TabsTrigger>
            <TabsTrigger value="process">Process data</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="min-h-0 overflow-auto pt-2">
            <Overview slave={slave} />
          </TabsContent>
          <TabsContent value="sdo" className="min-h-0 flex-1 overflow-hidden pt-2">
            <SdoEditor slave={slave.position} />
          </TabsContent>
          <TabsContent value="pdo" className="min-h-0 flex-1 overflow-hidden pt-2">
            <PdoMapEditor slave={slave.position} />
          </TabsContent>
          <TabsContent value="process" className="min-h-0 flex-1 overflow-hidden pt-2">
            <ProcessDataPanel slave={slave.position} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
