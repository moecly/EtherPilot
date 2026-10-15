import { AlStateBadge } from "@/components/al-state-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hex16, hex32 } from "@/lib/format";
import { useMasterStore } from "@/store/master";

export function SlaveStateTable() {
  const slaves = useMasterStore((s) => s.snapshot?.slaves);

  if (!slaves || slaves.length === 0) {
    return (
      <p className="text-muted-foreground p-3 text-xs">
        No slave state available.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Config</TableHead>
            <TableHead>Alias</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Rev</TableHead>
            <TableHead>DC</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>State</TableHead>
            <TableHead>AL</TableHead>
            <TableHead>I/O</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slaves.map((slave) => (
            <TableRow
              key={slave.position}
              className={
                slave.alStateError || slave.isLost
                  ? "bg-destructive/10 font-mono tabular-nums"
                  : "font-mono tabular-nums"
              }
            >
              <TableCell className="text-right">{slave.position}</TableCell>
              <TableCell className="font-sans">{slave.name}</TableCell>
              <TableCell>{hex16(slave.configAddr)}</TableCell>
              <TableCell>{slave.alias}</TableCell>
              <TableCell>{hex32(slave.vendorId)}</TableCell>
              <TableCell>{hex32(slave.productCode)}</TableCell>
              <TableCell>{hex32(slave.revision)}</TableCell>
              <TableCell>{slave.hasDc ? "yes" : "no"}</TableCell>
              <TableCell>
                {slave.isLost ? (
                  <span className="text-destructive">lost</span>
                ) : (
                  `p${slave.entryPort}`
                )}
              </TableCell>
              <TableCell>
                <AlStateBadge slave={slave} />
              </TableCell>
              <TableCell>
                {hex16(slave.alStatusCode)}
                <span className="text-muted-foreground ml-1">
                  {slave.alStatusText}
                </span>
              </TableCell>
              <TableCell>
                {slave.outputBytes}O/{slave.inputBytes}I
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
