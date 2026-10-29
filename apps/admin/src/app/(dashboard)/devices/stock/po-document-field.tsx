"use client";

import * as React from "react";
import { Download, ExternalLink, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatFileSize, PO_ACCEPT, PO_MAX_MB, poFileProblem, poKindLabel } from "@/lib/po-document";

export interface ExistingPoDocument {
  name: string;
  size: number | null;
  /** where View and Download go (the admin-only route that makes a short-lived link) */
  viewHref: string;
  downloadHref: string;
}

/**
 * The purchase order file of a stock item: choose a file (it is checked here before it goes up), see the one already stored with View and
 * Download, and replace or remove it. The file travels with the form as `poDocument`; "remove" travels as `removePoDocument`.
 */
export function PoDocumentField({ existing }: { existing?: ExistingPoDocument | null }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = React.useState<{ name: string; size: number } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [remove, setRemove] = React.useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return clear();
    const why = poFileProblem(file);
    if (why) {
      setProblem(why);
      setChosen(null);
      e.target.value = "";
      return;
    }
    setProblem(null);
    setChosen({ name: file.name, size: file.size });
    setRemove(false);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setChosen(null);
    setProblem(null);
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor="poDocument">Purchase order file</Label>

      {existing ? (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${remove || chosen ? "opacity-60" : ""}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <FileText className="size-4" />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <span className="truncate font-medium">{existing.name}</span>
            <span className="text-xs text-muted-foreground">{[poKindLabel(existing.name), formatFileSize(existing.size)].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={existing.viewHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                View
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={existing.downloadHref}>
                <Download />
                Download
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id="poDocument"
          name="poDocument"
          type="file"
          accept={PO_ACCEPT}
          onChange={onChange}
          className="sr-only"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload />
          {existing ? "Replace file" : "Choose file"}
        </Button>
        {chosen ? (
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate">{chosen.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(chosen.size)}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={clear} title="Don't upload this file">
              <X />
              <span className="sr-only">Don&apos;t upload this file</span>
            </Button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">PDF, photo or scan, Word or Excel. Up to {PO_MAX_MB} MB.</span>
        )}
      </div>

      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}

      {existing && !chosen ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="removePoDocument" checked={remove} onChange={(e) => setRemove(e.target.checked)} className="size-4 accent-[var(--color-destructive,currentColor)]" />
          Remove this file
        </label>
      ) : null}
    </div>
  );
}
