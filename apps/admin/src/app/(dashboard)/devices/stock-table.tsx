"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PackagePlus, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ModelStock } from "./stock-overview";
import { categoryLabel, makeAndModel, stockLevel, TRACKING_LABEL } from "./stock-types";

function LevelBadge({ level }: { level: "out" | "low" | "ok" }) {
  if (level === "out") return <Badge variant="destructive">Out of stock</Badge>;
  if (level === "low") return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">Low</Badge>;
  return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">In stock</Badge>;
}

/** The stock catalog's table: one line per model with what is available, reserved and installed; search and filters above it; a line opens the model's own page. */
export function StockTable({ rows }: { rows: ModelStock[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [tracking, setTracking] = React.useState("all");
  const [level, setLevel] = React.useState("all");

  const categories = React.useMemo(() => Array.from(new Set(rows.map((r) => r.model.category))).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))), [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ model, sum }) => {
      if (category !== "all" && model.category !== category) return false;
      if (tracking !== "all" && model.tracking !== tracking) return false;
      if (level !== "all") {
        const l = stockLevel(model, sum.available);
        if (level === "reorder" ? l === "ok" : l !== level) return false;
      }
      if (!q) return true;
      return [model.name, model.brand, model.model, model.model_number, model.manufacturer, categoryLabel(model.category)].filter(Boolean).some((field) => field!.toLowerCase().includes(q));
    });
  }, [rows, search, category, tracking, level]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, brand, model…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {categoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tracking} onValueChange={setTracking}>
          <SelectTrigger className="w-44" aria-label="How counted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Serial and lot</SelectItem>
            <SelectItem value="serial">By serial number</SelectItem>
            <SelectItem value="lot">By lot</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-44" aria-label="Stock level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any stock level</SelectItem>
            <SelectItem value="reorder">Needs reorder</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="ok">Well stocked</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length} models
          </span>
          <Button asChild variant="outline">
            <Link href="/devices/stock/new">
              <Plus />
              Add a model
            </Link>
          </Button>
          <Button asChild>
            <Link href="/devices/stock/receive">
              <PackagePlus />
              Receive stock
            </Link>
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Counted</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Installed</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No models yet. Add a model, then receive its stock." : "No models match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ model, sum }) => (
                <TableRow key={model.id} className="cursor-pointer" onClick={() => router.push(`/devices/stock/${model.id}`)}>
                  <TableCell>
                    <Link href={`/devices/stock/${model.id}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                      {model.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{makeAndModel(model)}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{categoryLabel(model.category)}</TableCell>
                  <TableCell className="text-muted-foreground">{TRACKING_LABEL[model.tracking] ?? model.tracking}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {sum.available}
                    {model.tracking === "lot" && model.primary_uom ? <span className="ml-1 text-xs font-normal text-muted-foreground">{model.primary_uom}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{sum.reserved}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{sum.installed}</TableCell>
                  <TableCell>
                    <LevelBadge level={stockLevel(model, sum.available)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/devices/stock/${model.id}`} onClick={(e) => e.stopPropagation()}>
                        Open
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
