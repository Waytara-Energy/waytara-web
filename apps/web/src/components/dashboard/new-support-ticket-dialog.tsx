"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, X } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { supportApi } from "@waytara/ui/support-client";
import { CATEGORIES, FILE_ACCEPT, MAX_BODY, MAX_FILES, acceptFiles, formatBytes } from "@waytara/ui/support-model";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SiteOption {
  id: string;
  name: string;
  devices: { id: string; name: string }[];
}

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Opens a ticket: which site (and device), what it is about, a subject, the message and up to five files. The ticket goes to the team of that
 *  site (its installer, its employees and the admins); anyone of them can take it, and you are e-mailed when they do. */
export function NewSupportTicketDialog({ sites, defaultSiteId }: { sites: SiteOption[]; defaultSiteId: string | null }) {
  const router = useRouter();
  const api = React.useMemo(() => supportApi(createClient()), []);
  const [open, setOpen] = React.useState(false);
  const [siteId, setSiteId] = React.useState(defaultSiteId ?? "");
  const [deviceId, setDeviceId] = React.useState("");
  const [category, setCategory] = React.useState<string>("device");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const picker = React.useRef<HTMLInputElement>(null);

  const site = sites.find((s) => s.id === siteId);
  const ready = subject.trim().length > 0 && body.trim().length > 0 && !busy;

  const take = (list: FileList | File[] | null) => {
    if (!list) return;
    const { accepted, problems: p } = acceptFiles(files, [...list]);
    setFiles((cur) => [...cur, ...accepted]);
    setProblems(p);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setProblems([]);
    try {
      const made = await api.createTicket({ siteId: siteId || null, equipmentId: deviceId || null, category, subject: subject.trim(), body: body.trim() });
      let failed: string[] = [];
      if (files.length > 0) failed = await api.attach(made.ticketId, made.messageId, files).catch(() => files.map((f) => f.name));
      notify.success(`Ticket ${`#${made.ticketNo}`} opened. We will e-mail you when someone takes it.`);
      if (failed.length > 0) notify.warning(`These files could not be uploaded: ${failed.join(", ")}. You can add them in the ticket.`);
      setOpen(false);
      setSubject("");
      setBody("");
      setFiles([]);
      setDeviceId("");
      router.push(`/dashboard/support/${made.ticketId}`);
      router.refresh();
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "The ticket could not be opened."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How can we help?</DialogTitle>
          <DialogDescription>The team that looks after your site will pick this up and reply here.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {sites.length > 1 && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Which site?</span>
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setDeviceId("");
                }}
                className={SELECT}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {site && site.devices.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Which device? <span className="font-normal text-muted-foreground">(optional)</span></span>
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={SELECT}>
                <option value="">Not about one device</option>
                {site.devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">What is it about?</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id} className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", category === c.id ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="flex items-baseline justify-between text-sm font-medium">
              Subject <span className="text-xs font-normal text-muted-foreground">{subject.length}/140</span>
            </span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 140))} required placeholder="e.g. Inverter beeps every evening" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Tell us what is happening</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))} rows={4} required placeholder="When did it start? What do you see on the inverter or the app?" />
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files);
            }}
            className={cn("rounded-xl border border-dashed p-3 transition-colors", dragging ? "border-primary bg-primary/5" : "border-border")}
          >
            <input ref={picker} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => take(e.target.files)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Photos, screenshots or documents help us: up to {MAX_FILES} files, 10 MB each.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()} disabled={files.length >= MAX_FILES}>
                <Paperclip className="size-4" />
                Add files
              </Button>
            </div>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {problems.length > 0 && (
            <ul className="space-y-0.5 text-sm text-destructive" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              {busy ? (files.length > 0 ? "Opening and uploading…" : "Opening…") : "Open ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
