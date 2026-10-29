"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isOutOfStock, makeAndModel, STATUS_OPTIONS, statusLabel, type StockRow } from "./stock-types";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  in_stock: "secondary",
  allocated: "outline",
  installed: "default",
  damaged: "destructive",
  returned: "outline",
};

/** The stock catalog's table: search and filters above it; a row (or its View button) opens the item's own page. */
export function StockTable({ items }: { items: StockRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const categories = React.useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.model_number, item.manufacturer, item.serial_number].filter(Boolean).some((field) => field!.toLowerCase().includes(q));
    });
  }, [items, search, category, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, brand, model, serial…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {items.length} items
          </span>
          <Button asChild>
            <Link href="/devices/stock/new">
              <Plus />
              Add stock item
            </Link>
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand / Manufacturer</TableHead>
              <TableHead>Serial number</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No stock items match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/devices/stock/${item.id}`)}>
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/devices/stock/${item.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-muted-foreground">{makeAndModel(item)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.serial_number || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.quantity}
                    {item.primary_uom ? ` ${item.primary_uom}` : ""}
                  </TableCell>
                  <TableCell>
                    {isOutOfStock(item) ? (
                      <Badge variant="destructive">Out of stock</Badge>
                    ) : (
                      <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"} className="capitalize">
                        {statusLabel(item.status)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/devices/stock/${item.id}`} onClick={(e) => e.stopPropagation()}>
                        View
                        <ChevronRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
