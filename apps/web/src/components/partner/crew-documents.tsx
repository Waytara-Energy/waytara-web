"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { memberRequirements, memberSubject, type OnboardingDocument } from "@waytara/supabase/partner-onboarding";
import { Button } from "@/components/ui/button";
import { DigilockerCard } from "./digilocker-card";
import { DocumentError, DocumentSlot, useDocumentStore } from "./file-slots";

/**
 * What a person on a partner's team sees at their own link: the documents asked of their kind of work, each as a slot, and a button to say they are done. The page
 * can only file under this one person: the link decides that on the server, whatever the browser sends.
 */
export function CrewDocuments({ token, memberKey, needsLicence, siteRole, initialDocuments, alreadyDone, initialByDigilocker }: { token: string; memberKey: string; needsLicence: boolean; siteRole: string; initialDocuments: OnboardingDocument[]; alreadyDone: boolean; initialByDigilocker: boolean }) {
  const base = `/api/partner/crew/${token}`;
  const subject = memberSubject(memberKey);
  const store = useDocumentStore(base, initialDocuments);
  const [done, setDone] = React.useState(alreadyDone);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  // verified through DigiLocker (the government's own record): the photo ID is no longer asked for
  const [byDigilocker, setByDigilocker] = React.useState(initialByDigilocker);
  const reqs = memberRequirements(needsLicence, siteRole, byDigilocker);
  const mine = store.docs.filter((d) => d.subject === subject).map((d) => d.kind);
  const missing = reqs.filter((r) => r.need === "required" && !(r.anyOf ?? [r.kind]).some((k) => mine.includes(k)));

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(base, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (res.ok && json?.success) setDone(true);
      else setError(json?.error ?? "Couldn't save that. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <DigilockerCard base={base} fills={false} onVerified={(_, v) => setByDigilocker(v.verdict === "passed")} />
      {reqs.map((r) => (
        <DocumentSlot key={r.kind} store={store} kind={r.kind} subject={subject} label={r.label} hint={r.hint} need={r.need} satisfied={r.anyOf ? r.anyOf.some((k) => mine.includes(k)) : undefined} />
      ))}
      <DocumentError store={store} />
      {done ? (
        <p role="status" className="flex items-center gap-2 pt-2 text-sm text-theme-primary">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Thank you. You are done, and you can close this page. You can come back to this link to add or change a file until the partner sends their application.
        </p>
      ) : (
        <div className="pt-2">
          {missing.length > 0 && <p className="mb-3 text-xs text-theme-muted">Still to add: {missing.map((r) => r.label.toLowerCase()).join(", ")}.</p>}
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="button" onClick={() => void finish()} disabled={saving || missing.length > 0}>
            {saving && <Loader2 className="size-4 animate-spin" />}I have added everything
          </Button>
        </div>
      )}
    </div>
  );
}
