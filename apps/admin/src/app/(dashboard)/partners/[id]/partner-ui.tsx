import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { cn } from "@waytara/ui/cn";
import { DOCUMENT_KIND_LABEL } from "@waytara/supabase/partner-onboarding";
import { CHECK_STATE_LABEL, type CheckState } from "@waytara/supabase/partner-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setPartnerItemCheck } from "./actions";

export interface PartnerDoc {
  id: string;
  kind: string;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
  subject: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** A small label for where an item stands: verified, problem found, or not checked yet. */
export function StateBadge({ state }: { state: CheckState }) {
  const Icon = state === "verified" ? CheckCircle2 : state === "problem" ? CircleAlert : CircleDashed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", state === "verified" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : state === "problem" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {CHECK_STATE_LABEL[state]}
    </span>
  );
}

/**
 * One thing to verify: what it is, what to confirm, where it stands, and the control to set it (with a note: what you checked, who you spoke to, a reference number).
 * `subject` is "partner" or "member:<id>": a team member is verified on their own. Keyed by what is saved, so the control shows the saved value after a save.
 */
export function VerifyRow({ appId, subject, itemKey, label, hint, state, note, checkedAt }: { appId: string; subject: string; itemKey: string; label: string; hint: string; state: CheckState; note: string | null; checkedAt: string | null }) {
  return (
    <ActionForm key={`${subject}-${itemKey}-${state}-${checkedAt ?? ""}-${note ?? ""}`} action={setPartnerItemCheck.bind(null, appId, subject, itemKey)} loading="Saving…" success="Saved." className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <StateBadge state={state} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[10.5rem_minmax(0,1fr)_auto]">
        <Select name="state" defaultValue={state}>
          <SelectTrigger className="w-full" aria-label={`${label}: state`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHECK_STATE_LABEL) as CheckState[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CHECK_STATE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input name="note" defaultValue={note ?? ""} maxLength={500} placeholder="Note: what you checked, who you spoke to, reference number" aria-label={`${label}: note`} />
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
      {checkedAt && <p className="mt-2 text-xs text-muted-foreground">Last set {when(checkedAt)}.</p>}
    </ActionForm>
  );
}

/** The files of one group (a tab, or one person): name, kind, size and date, with View and Download (each opening is logged). */
export function DocList({ appId, docs, empty = "Nothing sent yet." }: { appId: string; docs: PartnerDoc[]; empty?: string }) {
  if (docs.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border text-sm">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
          <span className="min-w-0">
            <span className="font-medium">{DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}</span> · <span className="break-all text-muted-foreground">{d.file_name}</span>
          </span>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {d.size_bytes >= 1048576 ? `${(d.size_bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(d.size_bytes / 1024))} KB`} · {when(d.uploaded_at)}
            </span>
            {/* plain links, not the router: each one is a view or download that the server logs before it serves the file */}
            <a href={`/partners/${appId}/files/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
              View
            </a>
            <a href={`/partners/${appId}/files/${d.id}?download=1`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Download
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A label and a value, for the details cards. */
export function Fact({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{children || "—"}</dd>
    </div>
  );
}
