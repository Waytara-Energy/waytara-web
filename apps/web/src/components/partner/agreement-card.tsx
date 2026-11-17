"use client";

import * as React from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { AGREEMENT_IS_DRAFT, AGREEMENT_TITLE, AGREEMENT_VERSION, agreementSections } from "@waytara/supabase/partner-agreement";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Signed = { version: string; signedAt: string } | null;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

/**
 * The Partner Agreement on the review page: a button that opens the full text, and below it the signing, which can only start once the text has been opened. Signing
 * sends a 6-digit code to the e-mail address we confirmed, and typing it records the acceptance (version, time, address, a fingerprint of the exact text). The
 * partner cannot send their onboarding until this is done. While the text is a draft awaiting a lawyer, the page says so.
 */
export function AgreementCard({ base, partnerType, email, onSigned }: { base: string; partnerType: string | null; email: string; onSigned: (signed: boolean) => void }) {
  const [signed, setSigned] = React.useState<Signed>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [read, setRead] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "send" | "sign">("");
  const [error, setError] = React.useState("");
  const sections = React.useMemo(() => agreementSections(partnerType), [partnerType]);

  React.useEffect(() => {
    let live = true;
    void call<{ signed: Signed }>(`${base}/agreement`, "GET").then((r) => {
      if (!live) return;
      if (r.ok) {
        setSigned(r.data.signed);
        onSigned(Boolean(r.data.signed));
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
    // onSigned is a state setter of the parent: running this once is the point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  async function send() {
    setBusy("send");
    setError("");
    const r = await call<null>(`${base}/agreement`, "POST", { action: "send" });
    setBusy("");
    if (r.ok) setSent(true);
    else setError(r.error);
  }
  async function sign() {
    setBusy("sign");
    setError("");
    const r = await call<Signed>(`${base}/agreement`, "POST", { action: "sign", code: code.trim() });
    setBusy("");
    if (r.ok && r.data) {
      setSigned(r.data);
      onSigned(true);
    } else if (!r.ok) setError(r.error);
  }

  return (
    <section aria-labelledby="ob-agreement" className="mt-8 rounded-2xl border border-theme-border p-5">
      <h3 id="ob-agreement" className="flex items-center gap-2 text-[15px] font-semibold text-theme-primary">
        <FileText className="size-4" aria-hidden="true" /> Partner Agreement
      </h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-theme-secondary">The agreement, with its indemnity and confidentiality, that applies to every job you do through WayTara. Read it, then sign it with a code we e-mail you.</p>

      {!loaded ? (
        <Loader2 className="mt-4 size-4 animate-spin text-theme-muted" aria-label="Loading" />
      ) : signed ? (
        <p role="status" className="mt-4 flex items-start gap-2 text-sm text-theme-primary">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>
            Signed on {dateTime(signed.signedAt)}. <span className="text-theme-muted">Version {signed.version}</span>
          </span>
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(true);
              setRead(true);
            }}
          >
            Read the Partner Agreement
          </Button>
          {read && !sent && (
            <div>
              <Button type="button" onClick={() => void send()} disabled={busy !== ""}>
                {busy === "send" && <Loader2 className="size-4 animate-spin" />}Send me the signing code
              </Button>
              <p className="mt-2 text-xs text-theme-muted">The code goes to {email}. Typing it is your signature.</p>
            </div>
          )}
          {!read && <p className="text-xs text-theme-muted">Open and read the agreement first. Then you can ask for the signing code.</p>}
          {sent && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="ob-agr-code">The 6-digit code we e-mailed you</Label>
              <Input id="ob-agr-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="button" onClick={() => void sign()} disabled={busy !== "" || code.length !== 6}>
                  {busy === "sign" && <Loader2 className="size-4 animate-spin" />}Sign the agreement
                </Button>
                <button type="button" onClick={() => void send()} disabled={busy !== ""} className="text-xs text-theme-muted underline underline-offset-4 hover:text-theme-primary disabled:opacity-50">
                  Send a new code
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-2xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-theme-border p-6 pb-4 text-left">
            <DialogTitle>{AGREEMENT_TITLE}</DialogTitle>
            <DialogDescription>Version {AGREEMENT_VERSION}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {AGREEMENT_IS_DRAFT && (
              <p role="note" className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm leading-relaxed text-theme-primary">
                This is a draft that WayTara&apos;s lawyer has not yet reviewed. The final text may change before it takes effect.
              </p>
            )}
            <div className="space-y-6 text-sm leading-relaxed text-theme-secondary">
              {sections.map((s, i) => (
                <section key={s.heading}>
                  <h4 className="font-semibold text-theme-primary">
                    {i + 1}. {s.heading}
                  </h4>
                  <ol className="mt-2 space-y-2">
                    {s.clauses.map((c, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="shrink-0 tabular-nums text-theme-muted">
                          {i + 1}.{j + 1}
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </div>
          <div className="border-t border-theme-border p-4 text-right">
            <Button type="button" onClick={() => setOpen(false)}>
              I have read it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
