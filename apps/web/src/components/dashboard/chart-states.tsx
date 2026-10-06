"use client";

import * as React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDelayedLoading } from "./use-delayed-loading";

/** The four states every data card goes through. Loading shimmers (after a short delay, never flashing), empty
 *  says "waiting for data", error offers a retry, and a refresh of already-shown data is silent (the card keeps
 *  its content - there is no state for it on purpose). All of them keep the same outer size, so nothing moves. */

export function ChartLoadingCard({ title, height = 240, footer = true }: { title: string; height?: number; footer?: boolean }) {
  const { showSkeleton } = useDelayedLoading(true);
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {showSkeleton ? <Skeleton className="h-4 w-48" /> : <div className="h-4" />}
      </CardHeader>
      <CardContent>
        {showSkeleton ? <Skeleton className="w-full rounded-lg" style={{ height }} /> : <div style={{ height }} />}
      </CardContent>
      {footer && (
        <div className="px-6 pb-6">{showSkeleton ? <Skeleton className="h-4 w-56 max-w-full" /> : <div className="h-4" />}</div>
      )}
    </Card>
  );
}

export function ChartErrorCard({ title, message, onRetry, height = 240 }: { title: string; message?: string | null; onRetry: () => void; height?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>We couldn&apos;t load this chart.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: height }}>
          <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </div>
          {message && <p className="max-w-sm text-xs text-muted-foreground">{message}</p>}
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** A small "showing saved data, refreshing" / "reconnecting" marker - no layout cost, never a spinner over content. */
export function StaleDot({ show, label }: { show: boolean; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("inline-block size-1.5 rounded-full bg-amber-500 transition-opacity", show ? "animate-pulse opacity-100" : "opacity-0")}
    />
  );
}
