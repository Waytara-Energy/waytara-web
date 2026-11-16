"use client";

import * as React from "react";
import { CheckCircle2, Download, Eye, FileText, ImageIcon, Loader2, MoreHorizontal, Plus, Trash2, Upload } from "lucide-react";
import { DOCUMENT_KIND_LABEL, DOCUMENT_MAX_FILES, NEED_LABEL, documentProblem, fileTypeLabel, type Need, type OnboardingDocument } from "@waytara/supabase/partner-onboarding";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(url: string, method: string, body?: unknown): Promise<Reply<T>> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

export interface DocumentStore {
  docs: OnboardingDocument[];
  /** The slot a file is being sent for right now ("<subject>|<kind>"), or null. */
  busy: string | null;
  error: string;
  /** False when files cannot be changed (sent for verification): the lists are then read-only. */
  editable: boolean;
  base: string;
  add: (kind: string, subject: string, file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * The partner's files and the two things that can be done to them: add one (it goes straight from the browser to private storage through a one-time address, then
 * the server checks it arrived and records it) and take one back. `before` runs first when a file is added (the onboarding form uses it to save a newly typed team
 * member, so the server knows whose file it is).
 */
export function useDocumentStore(base: string, initial: OnboardingDocument[], opts?: { editable?: boolean; before?: () => Promise<boolean>; onChange?: () => void }): DocumentStore {
  const [docs, setDocs] = React.useState<OnboardingDocument[]>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const before = opts?.before;
  const onChange = opts?.onChange;

  const add = React.useCallback(
    async (kind: string, subject: string, file: File) => {
      setError("");
      const problem = documentProblem(file.name, file.size);
      if (problem) return setError(`${file.name}: ${problem}`);
      setBusy(`${subject}|${kind}`);
      try {
        if (before && !(await before())) return setError("Your latest changes couldn't be saved yet. Please try again in a moment.");
        const start = await call<{ path: string; uploadUrl: string }>(`${base}/upload`, "POST", { kind, subject, name: file.name, size: file.size });
        if (!start.ok) return setError(`${file.name}: ${start.error}`);
        const body = new FormData();
        body.append("cacheControl", "3600");
        body.append("", file);
        let put: Response | null = null;
        try {
          put = await fetch(start.data.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
        } catch {
          put = null;
        }
        if (!put?.ok) return setError(`${file.name} didn't upload. Please check your connection and try again.`);
        const done = await call<OnboardingDocument>(`${base}/documents`, "POST", { kind, subject, name: file.name, path: start.data.path });
        if (!done.ok) return setError(`${file.name}: ${done.error}`);
        setDocs((d) => [...d, done.data]);
        onChange?.();
      } finally {
        setBusy(null);
      }
    },
    [base, before, onChange],
  );

  const remove = React.useCallback(
    async (id: string) => {
      setError("");
      const r = await call<null>(`${base}/documents/${id}`, "DELETE");
      if (r.ok) {
        setDocs((d) => d.filter((x) => x.id !== id));
        onChange?.();
      } else setError(r.error);
    },
    [base, onChange],
  );

  return { docs, busy, error, editable: opts?.editable ?? true, base, add, remove };
}

/** The coloured tile that says at a glance what a file is: a PDF or a picture. */
function TypeTile({ name }: { name: string }) {
  const t = fileTypeLabel(name);
  const Icon = t.type === "image" ? ImageIcon : FileText;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        t.type === "pdf" ? "bg-red-500/10 text-red-600 dark:text-red-400" : t.type === "image" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-theme-surface text-theme-muted",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

const iconButton = "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-theme-muted outline-none transition-colors hover:bg-theme-surface hover:text-theme-primary focus-visible:ring-2 focus-visible:ring-emerald-500";

/** One file: what it is (PDF or image), its name, size and date, a download button, and a menu with View, Download and Remove. */
export function FileRow({ doc, store }: { doc: OnboardingDocument; store: DocumentStore }) {
  const [removing, setRemoving] = React.useState(false);
  const href = `${store.base}/documents/${doc.id}`;
  const t = fileTypeLabel(doc.name);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-theme-border bg-theme-bg px-3 py-2.5">
      <TypeTile name={doc.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-theme-primary" title={doc.name}>
          {doc.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-theme-muted">
          <span className={cn("rounded px-1.5 py-px font-medium", t.type === "pdf" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-sky-500/10 text-sky-700 dark:text-sky-300")}>{t.label}</span>
          <span>{sizeLabel(doc.size)}</span>
          <span>{dateLabel(doc.uploadedAt)}</span>
        </p>
      </div>
      {removing ? (
        <Loader2 className="mr-2 size-4 animate-spin text-theme-muted" aria-label="Removing" />
      ) : (
        <>
          <a href={`${href}?download=1`} className={iconButton} aria-label={`Download ${doc.name}`} title="Download">
            <Download className="size-4" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger className={iconButton} aria-label={`More for ${doc.name}`}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Eye className="size-4" /> View
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`${href}?download=1`}>
                  <Download className="size-4" /> Download
                </a>
              </DropdownMenuItem>
              {store.editable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setRemoving(true);
                      void store.remove(doc.id).finally(() => setRemoving(false));
                    }}
                  >
                    <Trash2 className="size-4" /> Remove
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );
}

const NEED_STYLE: Record<Need, string> = {
  required: "border-theme-primary/30 text-theme-primary",
  conditional: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  optional: "border-theme-border text-theme-muted",
};

/**
 * One document we ask for: what it is, whether it is required, the files sent for it, and a button to add one. `subject` says whose it is (the partner, a team member
 * or a kind of past work). `alsoCounts` are files of other kinds that satisfy the same need (an own licence, or a tie-up with a licensed contractor).
 */
export function DocumentSlot({ store, kind, subject = "partner", label, hint, need, satisfied }: { store: DocumentStore; kind: string; subject?: string; label: string; hint?: string; need: Need; satisfied?: boolean }) {
  const id = React.useId();
  const mine = store.docs.filter((d) => d.kind === kind && d.subject === subject);
  const sending = store.busy === `${subject}|${kind}`;
  const full = store.docs.length >= DOCUMENT_MAX_FILES;
  const done = mine.length > 0 || Boolean(satisfied);
  return (
    <div className="rounded-2xl border border-theme-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-theme-primary">
            {done && <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Added" />}
            {label}
            <span className={cn("rounded-full border px-2 py-px text-[11px] font-medium", NEED_STYLE[need])}>{NEED_LABEL[need]}</span>
          </p>
          {hint && <p className="mt-1 text-xs leading-relaxed text-theme-muted">{hint}</p>}
        </div>
        {store.editable && (
          <label className="inline-flex" htmlFor={id}>
            <input
              id={id}
              type="file"
              accept={ACCEPT}
              className="peer sr-only"
              disabled={store.busy !== null || full}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void store.add(kind, subject, f);
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-theme-border px-3 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-surface peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" /> : mine.length > 0 ? <Plus className="size-4" /> : <Upload className="size-4" />}
              {sending ? "Sending…" : mine.length > 0 ? "Add another" : "Add file"}
            </span>
          </label>
        )}
      </div>
      {mine.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mine.map((d) => (
            <FileRow key={d.id} doc={d} store={store} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "Add another document": a menu of the kinds that are not asked for by name on this page, then the file picker. The files sent this way are listed under it, each
 * with what it was sent as.
 */
export function ExtraDocuments({ store, kinds, subject = "partner", shownKinds }: { store: DocumentStore; kinds: readonly string[]; subject?: string; shownKinds: readonly string[] }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<string>(kinds[0] ?? "other");
  const extra = store.docs.filter((d) => d.subject === subject && !shownKinds.includes(d.kind) && kinds.includes(d.kind));
  if (!store.editable && extra.length === 0) return null;
  return (
    <div className="space-y-3">
      {extra.length > 0 && (
        <ul className="space-y-2">
          {extra.map((d) => (
            <li key={d.id} className="space-y-1">
              <p className="text-xs text-theme-muted">{DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}</p>
              <ul>
                <FileRow doc={d} store={store} />
              </ul>
            </li>
          ))}
        </ul>
      )}
      {store.editable && (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void store.add(kind, subject, f);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger disabled={store.busy !== null} className="inline-flex h-9 items-center gap-2 rounded-md border border-dashed border-theme-border px-3 text-sm font-medium text-theme-secondary outline-none transition-colors hover:bg-theme-surface hover:text-theme-primary focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50">
              {store.busy !== null && kinds.some((k) => store.busy === `${subject}|${k}`) ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add another document
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-theme-muted">What is it?</DropdownMenuLabel>
              {kinds.map((k) => (
                <DropdownMenuItem
                  key={k}
                  onSelect={() => {
                    setKind(k);
                    // after the menu has closed, so the picker is not closed with it
                    setTimeout(() => input.current?.click(), 50);
                  }}
                >
                  {DOCUMENT_KIND_LABEL[k] ?? k}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

/** What went wrong with the last file, where the partner will see it. */
export function DocumentError({ store }: { store: DocumentStore }) {
  if (!store.error) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {store.error}
    </p>
  );
}
