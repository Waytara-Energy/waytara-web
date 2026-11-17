import { CheckCircle2, CircleAlert, CircleDashed, FileText, ImageIcon } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { cn } from "@waytara/ui/cn";
import { DOCUMENT_KIND_LABEL, NEED_LABEL, fileTypeLabel, type Need } from "@waytara/supabase/partner-onboarding";
import { CHECK_STATE_LABEL, type CheckState } from "@waytara/supabase/partner-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocActions } from "./doc-actions";
import { KIND_LABEL, STATUS_LABEL, type VerificationKind, type VerificationStatus } from "@waytara/supabase/partner-verify-rules";
import { acceptAutoCheck, runAllPartnerAutoChecks, runPartnerAutoCheck, setPartnerItemCheck } from "./actions";

export interface PartnerDoc {
  id: string;
  kind: string;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
  subject: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const sizeLabel = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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

const AUTO_TONE: Record<VerificationStatus, string> = {
  passed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  review: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  error: "border-border text-muted-foreground",
};

/** Why a check might not have run yet: what it needs. */
const NOT_RUN_WHY: Record<VerificationKind, string> = {
  pan: "Runs when the partner has entered a PAN.",
  gstin: "Runs when the partner has entered a GST number.",
  bank: "Runs when the partner has entered the account number, the IFSC and the name on the account.",
  name_match: "Runs once the PAN and the bank account have both been found, to compare the two names.",
  face_match: "Runs when there is a selfie and a photo ID that is a JPEG or PNG picture (not a PDF).",
  face_liveness: "Runs when there is a selfie that is a JPEG or PNG picture.",
};

export interface AutoResult {
  status: VerificationStatus;
  summary: string;
  updated_at: string;
}

/**
 * The automatic checks (Cashfree) of one partner or one team member: for each, what it found in one line, when, and a button to run it again. A passed result can be accepted
 * with one click as the admin's own check (`accept` says which check it supports and where that stands); a result that needs a look or failed is never accepted this way.
 * The checks are evidence, never the decision. `all` adds a button that asks for everything that is new or changed.
 */
export function AutoChecks({
  appId,
  subject,
  kinds,
  results,
  on,
  env,
  accept,
  all,
}: {
  appId: string;
  subject: string;
  kinds: readonly VerificationKind[];
  results: Record<string, AutoResult | undefined>;
  on: boolean;
  env: "production" | "sandbox";
  /** For a kind whose passed result can be accepted: the name of the check it supports and that check's state now. */
  accept?: Partial<Record<VerificationKind, { label: string; state: CheckState }>>;
  all?: boolean;
}) {
  if (!on) {
    return <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Automatic checks are not set up on this server (the Cashfree keys are missing), so everything here is checked by hand.</p>;
  }
  return (
    <div className="space-y-3">
      {env === "sandbox" && <p className="text-xs text-amber-700 dark:text-amber-300">Test mode: these results come from Cashfree&apos;s sandbox, which knows only its own sample numbers. A real PAN or account will come back as not found until the live key is used.</p>}
      {kinds.map((kind) => {
        const r = results[`${subject}|${kind}`];
        const acc = accept?.[kind];
        return (
          <div key={kind} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {KIND_LABEL[kind]}
                  {r ? <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", AUTO_TONE[r.status])}>{STATUS_LABEL[r.status]}</span> : <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">Not run yet</span>}
                </p>
                {!r && <p className="mt-1 text-xs text-muted-foreground">{NOT_RUN_WHY[kind]}</p>}
                {r && <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>}
                {r && <p className="mt-1 text-xs text-muted-foreground">Checked {when(r.updated_at)}.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r?.status === "passed" && acc && acc.state !== "verified" && (
                  <ActionForm action={acceptAutoCheck.bind(null, appId, kind, subject)} loading="Saving…" success="Marked verified.">
                    <Button type="submit" size="sm">
                      Mark {acc.label} as verified
                    </Button>
                  </ActionForm>
                )}
                {r?.status === "passed" && acc && acc.state === "verified" && <span className="text-xs text-emerald-600 dark:text-emerald-400">{acc.label} is verified</span>}
                <ActionForm action={runPartnerAutoCheck.bind(null, appId, kind, subject)} loading="Checking…" success="Checked.">
                  <Button type="submit" size="sm" variant="outline">
                    {r ? "Run again" : "Run"}
                  </Button>
                </ActionForm>
              </div>
            </div>
          </div>
        );
      })}
      {all && (
        <ActionForm action={runAllPartnerAutoChecks.bind(null, appId)} loading="Checking…" success="Done. Anything new or changed was checked.">
          <Button type="submit" size="sm" variant="outline">
            Run every automatic check that is new or changed
          </Button>
        </ActionForm>
      )}
    </div>
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

/** One file: a tile that says PDF or image, the name, what it was sent as, its size and date, and View, Download and a menu (each opening is logged). */
function FileRow({ appId, doc, canAsk, showKind }: { appId: string; doc: PartnerDoc; canAsk: boolean; showKind: boolean }) {
  const t = fileTypeLabel(doc.file_name);
  const Icon = t.type === "image" ? ImageIcon : FileText;
  const kind = DOCUMENT_KIND_LABEL[doc.kind] ?? doc.kind;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", t.type === "pdf" ? "bg-red-500/10 text-red-600 dark:text-red-400" : t.type === "image" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-muted text-muted-foreground")}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={doc.file_name}>
          {doc.file_name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={cn("rounded px-1.5 py-px font-medium", t.type === "pdf" ? "bg-red-500/10 text-red-700 dark:text-red-300" : t.type === "image" ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-muted")}>{t.label}</span>
          {showKind && <span>{kind}</span>}
          <span>{sizeLabel(doc.size_bytes)}</span>
          <span>{when(doc.uploaded_at)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <DocActions appId={appId} docId={doc.id} fileName={doc.file_name} kindLabel={kind} canAsk={canAsk} />
      </div>
    </li>
  );
}

/** The files of one group (a person, a kind of past work, or what is left over), each as a row. */
export function DocList({ appId, docs, canAsk = false, empty = "Nothing sent yet." }: { appId: string; docs: PartnerDoc[]; canAsk?: boolean; empty?: string }) {
  if (docs.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <FileRow key={d.id} appId={appId} doc={d} canAsk={canAsk} showKind />
      ))}
    </ul>
  );
}

export interface DocSlot {
  kind: string;
  label: string;
  need: Need;
  /** Why it is asked: the rule behind it. */
  basis?: string;
  /** Other kinds that satisfy the same need (a tie-up in place of an own licence). */
  anyOf?: readonly string[];
}

const NEED_STYLE: Record<Need, string> = { required: "border-foreground/30 text-foreground", conditional: "border-amber-500/40 text-amber-600 dark:text-amber-400", optional: "border-border text-muted-foreground" };

/**
 * The documents asked of this partner on one tab, each as its own slot: what it is, whether it is required and why it is asked, and the files sent for it, or "Not
 * sent" in red when a required one is missing. `subject` says whose they are. `restKinds` names the other kinds that belong on this tab ("all" for a person): files of
 * those kinds that fit no slot are listed last.
 */
export function DocSlots({ appId, slots, docs, subject = "partner", canAsk = false, restKinds }: { appId: string; slots: DocSlot[]; docs: PartnerDoc[]; subject?: string; canAsk?: boolean; restKinds?: readonly string[] | "all" }) {
  const mine = docs.filter((d) => d.subject === subject);
  const shown = new Set(slots.map((s) => s.kind));
  // only where the tab says which other kinds belong on it: without that, every tab would list every other file of the partner
  const rest = restKinds ? mine.filter((d) => !shown.has(d.kind) && (restKinds === "all" || restKinds.includes(d.kind))) : [];
  return (
    <div className="space-y-3">
      {slots.map((s) => {
        const files = mine.filter((d) => d.kind === s.kind);
        const covered = files.length === 0 && (s.anyOf ?? []).some((k) => k !== s.kind && mine.some((d) => d.kind === k));
        return (
          <div key={s.kind} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.label}
                  <span className={cn("rounded-full border px-2 py-px text-[11px] font-medium", NEED_STYLE[s.need])}>{NEED_LABEL[s.need]}</span>
                </p>
                {s.basis && <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{s.basis}</p>}
              </div>
              {files.length === 0 && <span className={cn("text-xs font-medium", covered ? "text-muted-foreground" : s.need === "required" ? "text-destructive" : "text-muted-foreground")}>{covered ? "Covered by another document" : "Not sent"}</span>}
            </div>
            {files.length > 0 && (
              <ul className="mt-2.5 space-y-2">
                {files.map((d) => (
                  <FileRow key={d.id} appId={appId} doc={d} canAsk={canAsk} showKind={false} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {rest.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Also sent</p>
          <DocList appId={appId} docs={rest} canAsk={canAsk} />
        </div>
      )}
    </div>
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
