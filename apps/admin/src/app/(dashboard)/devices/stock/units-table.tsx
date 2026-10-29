"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, Search } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { deleteUnit, releaseUnit, reserveUnit, setUnitStatus, type ActionResult } from "../actions";
import { STATUS_DOT, StockStatusBadge } from "../stock-status-badge";
import { formatDate, MANUAL_STATUSES, statusLabel, type UnitRow } from "../stock-types";

/** A unit with what the page knows about it: who it is for, and the delivery it came in on. */
export interface UnitView extends UnitRow {
  customerName: string | null;
  siteName: string | null;
  receivedOn: string | null;
  poReference: string | null;
  supplier: string | null;
  poFileHref: string | null;
}

export interface CustomerChoice {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
}

/** Turns an action's result into a toast and a refresh. */
function useReport() {
  const router = useRouter();
  return React.useCallback(
    (result: ActionResult) => {
      if (result.ok) {
        notify.success(result.message ?? "Done.");
        router.refresh();
      } else {
        notify.error(result.error);
      }
    },
    [router],
  );
}

function ReserveDialog({ unit, customers, onClose }: { unit: UnitView | null; customers: CustomerChoice[]; onClose: () => void }) {
  const report = useReport();
  const [customerId, setCustomerId] = React.useState("");
  const [siteId, setSiteId] = React.useState("none");
  const [busy, setBusy] = React.useState(false);
  const customer = customers.find((c) => c.id === customerId);

  async function submit() {
    if (!unit) return;
    setBusy(true);
    const result = await reserveUnit(unit.id, customerId, siteId === "none" ? null : siteId);
    setBusy(false);
    report(result);
    if (result.ok) {
      setCustomerId("");
      setSiteId("none");
      onClose();
    }
  }

  return (
    <Dialog open={!!unit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserve for a customer</DialogTitle>
          <DialogDescription>
            Holds <span className="font-mono">{unit?.serial_number}</span> so nobody else can take it. It is installed when the customer&apos;s device is set up.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setSiteId("none"); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {customer && customer.sites.length > 0 ? (
            <div className="grid gap-2">
              <Label>Site (optional)</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not decided yet</SelectItem>
                  {customer.sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!customerId || busy}>
            {busy ? "Reserving…" : "Reserve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnitMenu({ unit, onReserve }: { unit: UnitView; onReserve: (u: UnitView) => void }) {
  const report = useReport();
  const [busy, setBusy] = React.useState(false);
  const run = async (action: () => Promise<ActionResult>) => {
    setBusy(true);
    report(await action());
    setBusy(false);
  };

  const movable = !["reserved", "installed", "used_up"].includes(unit.status);
  const untouched = unit.status === "in_stock" && unit.remaining === unit.quantity;
  const none = !movable && unit.status !== "reserved" && !(unit.status === "in_stock" && unit.quantity === 1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Actions for ${unit.serial_number}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {unit.status === "in_stock" && unit.quantity === 1 ? <DropdownMenuItem onSelect={() => onReserve(unit)}>Reserve for a customer…</DropdownMenuItem> : null}
        {unit.status === "reserved" ? <DropdownMenuItem onSelect={() => run(() => releaseUnit(unit.id))}>Release back to stock</DropdownMenuItem> : null}
        {movable ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Mark as</DropdownMenuLabel>
            {MANUAL_STATUSES.filter((s) => s !== unit.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => run(() => setUnitStatus(unit.id, s, null))}>
                <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
                {statusLabel(s)}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {untouched ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (window.confirm(`Remove ${unit.serial_number}? Use this only for a unit entered by mistake.`)) void run(() => deleteUnit(unit.id));
              }}
            >
              Remove (entered by mistake)
            </DropdownMenuItem>
          </>
        ) : null}
        {none ? <DropdownMenuItem disabled>Nothing to do here</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The stock of one model, unit by unit: filter by status or search a serial number; a menu on each line reserves, releases, changes its state or removes it. */
export function UnitsTable({ units, customers, tracking, uom }: { units: UnitView[]; customers: CustomerChoice[]; tracking: string; uom: string | null }) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [reserving, setReserving] = React.useState<UnitView | null>(null);
  const lot = tracking === "lot";

  const counts = React.useMemo(() => {
    const c = new Map<string, number>();
    for (const u of units) c.set(u.status, (c.get(u.status) ?? 0) + 1);
    return c;
  }, [units]);

  const q = search.trim().toLowerCase();
  const shown = units.filter((u) => (status === "all" || u.status === status) && (!q || [u.serial_number, u.customerName, u.siteName, u.poReference, u.supplier, u.location].some((f) => f?.toLowerCase().includes(q))));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={lot ? "Search lot, customer, PO…" : "Search serial, customer, PO…"} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>
            All <span className="ml-1 tabular-nums opacity-70">{units.length}</span>
          </Button>
          {[...counts.entries()].map(([s, n]) => (
            <Button key={s} type="button" size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
              {statusLabel(s)} <span className="tabular-nums opacity-70">{n}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lot ? "Lot" : "Serial number"}</TableHead>
              <TableHead>Status</TableHead>
              {lot ? <TableHead className="text-right">Left / total</TableHead> : null}
              <TableHead>With</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={lot ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                  {units.length === 0 ? "No stock yet. Use Receive stock when a delivery arrives." : "Nothing matches."}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {u.serial_number}
                    {u.location ? <div className="mt-0.5 font-sans text-xs font-normal text-muted-foreground">{u.location}</div> : null}
                  </TableCell>
                  <TableCell>
                    <StockStatusBadge status={u.status} />
                  </TableCell>
                  {lot ? (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {u.remaining} / {u.quantity}
                      {uom ? ` ${uom}` : ""}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm text-muted-foreground">
                    {u.customerName ? (
                      <>
                        <div className="text-foreground">{u.customerName}</div>
                        {u.siteName ? <div className="text-xs">{u.siteName}</div> : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{formatDate(u.receivedOn)}</div>
                    {u.poReference || u.supplier ? (
                      <div className="flex items-center gap-1 text-xs">
                        {[u.poReference, u.supplier].filter(Boolean).join(" · ")}
                        {u.poFileHref ? (
                          <a href={u.poFileHref} target="_blank" rel="noopener noreferrer" title="View the purchase order" className="inline-flex items-center text-primary hover:underline">
                            <FileText className="size-3.5" />
                            <span className="sr-only">View the purchase order</span>
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <UnitMenu unit={u} onReserve={setReserving} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ReserveDialog unit={reserving} customers={customers} onClose={() => setReserving(null)} />
    </div>
  );
}
