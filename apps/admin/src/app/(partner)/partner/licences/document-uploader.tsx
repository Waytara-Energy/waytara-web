"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { DOCUMENT_KINDS, documentProblem } from "@waytara/supabase/partner-onboarding";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { finishPartnerUpload, removePartnerDocument, startPartnerUpload } from "./actions";

const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export interface DocItem {
  id: string;
  kind: string;
  name: string;
  size: number;
  uploadedAt: string;
}

/**
 * The partner's documents: add one (it goes straight from the browser to the private storage through a one-time address, then is recorded after the server has checked
 * it), or take one back. A file cannot be opened again from here: the partner sends, the team verifies.
 */
export function DocumentUploader({ items }: { items: DocItem[] }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<string>("licence");
  const [busy, setBusy] = React.useState(false);

  async function add(file: File) {
    const problem = documentProblem(file.name, file.size);
    if (problem) return notify.error(`${file.name}: ${problem}`);
    setBusy(true);
    try {
      const start = await startPartnerUpload({ kind, name: file.name, size: file.size });
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const put = await fetch(start.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
      if (!put.ok) throw new Error(`${file.name} didn't upload. Please check your connection and try again.`);
      await finishPartnerUpload({ kind, name: file.name, path: start.path });
      notify.success("File sent.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await removePartnerDocument(id);
      notify.success("File removed.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="doc-kind" className="text-sm font-medium">
            What is it?
          </label>
          <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="peer sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void add(f);
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Sending…" : "Choose a file"}
          </span>
        </label>
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP, up to 10 MB.</p>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{DOCUMENT_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind}</span> · <span className="break-all">{d.name}</span>
              </span>
              <span className="flex items-center gap-3 text-muted-foreground">
                <span>
                  {sizeLabel(d.size)} · {new Date(d.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => void remove(d.id)}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      )}
    </div>
  );
}
