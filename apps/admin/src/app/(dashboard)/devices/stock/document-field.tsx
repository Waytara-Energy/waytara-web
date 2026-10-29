"use client";

import * as React from "react";
import { Download, ExternalLink, FileText, Loader2, Upload, X } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DOC_ACCEPT, DOC_SLOTS, documentKindLabel, documentProblem, formatFileSize, maxMegabytes, mimeOf, newDocumentPath, type DocSlot } from "@/lib/stock-documents";

export interface ExistingDocument {
  name: string;
  size: number | null;
  /** where View and Download go (the admin-only route that makes a short-lived link) */
  viewHref: string;
  downloadHref: string;
}

interface Uploaded {
  path: string;
  name: string;
  size: number;
}

/**
 * One file of a stock item (its purchase order, user manual or data sheet): choose a file and it goes straight from the browser to its private bucket
 * (so its size is not limited by the app's server), see the one already stored with View and Download, and replace or remove it. The form carries
 * where the new file is (`<slot>Path`, `<slot>Name`) and, when asked, `<slot>Remove`; the file itself never travels with the form. The form can't be
 * sent while a file is still going up.
 */
export function DocumentField({ slot, existing, hint }: { slot: DocSlot; existing?: ExistingDocument | null; hint?: string }) {
  const { label, bucket } = DOC_SLOTS[slot];
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = React.useState<Uploaded | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [remove, setRemove] = React.useState(false);

  // while a file is going up, the form cannot be sent: the browser says why next to the button
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(uploading ? `Wait for the ${label.toLowerCase()} to finish uploading.` : "");
  }, [uploading, label]);

  /** Takes a file that was uploaded but never recorded off the bucket again. */
  async function dropUploaded(file: Uploaded | null) {
    if (file) await createClient().storage.from(bucket).remove([file.path]);
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const why = documentProblem(slot, file.name, file.size);
    if (why) return setProblem(why);

    setProblem(null);
    setUploading(file.name);
    const path = newDocumentPath(file.name);
    const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: mimeOf(file.name) ?? undefined, upsert: false });
    setUploading(null);
    if (error) return setProblem(`The file couldn't be uploaded: ${error.message}`);

    const previous = uploaded;
    setUploaded({ path, name: file.name, size: file.size });
    setRemove(false);
    await dropUploaded(previous);
  }

  async function clear() {
    const previous = uploaded;
    setUploaded(null);
    setProblem(null);
    await dropUploaded(previous);
  }

  const id = `${slot}-file`;
  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {uploaded ? (
        <>
          <input type="hidden" name={`${slot}Path`} value={uploaded.path} />
          <input type="hidden" name={`${slot}Name`} value={uploaded.name} />
        </>
      ) : null}

      {existing ? (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${remove || uploaded ? "opacity-60" : ""}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <FileText className="size-4" />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <span className="truncate font-medium">{existing.name}</span>
            <span className="text-xs text-muted-foreground">{[documentKindLabel(existing.name), formatFileSize(existing.size)].filter(Boolean).join(" · ")}</span>
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
        {/* no `name`: the file is not part of the form, only where it was uploaded to */}
        <input ref={inputRef} id={id} type="file" accept={DOC_ACCEPT} onChange={onChange} className="sr-only" />
        <Button type="button" variant="outline" size="sm" disabled={!!uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading ? "Uploading…" : existing || uploaded ? "Replace file" : "Choose file"}
        </Button>
        {uploading ? (
          <span className="truncate text-sm text-muted-foreground">{uploading}</span>
        ) : uploaded ? (
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate">{uploaded.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(uploaded.size)} · uploaded, saved with the item</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={clear} title="Don't use this file">
              <X />
              <span className="sr-only">Don&apos;t use this file</span>
            </Button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{hint ?? `PDF, photo or scan, Word or Excel. Up to ${maxMegabytes(slot)} MB.`}</span>
        )}
      </div>

      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}

      {existing && !uploaded ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name={`${slot}Remove`} checked={remove} onChange={(e) => setRemove(e.target.checked)} className="size-4" />
          Remove this file
        </label>
      ) : null}
    </div>
  );
}
