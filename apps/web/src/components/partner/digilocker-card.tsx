"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Info, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What the page knows about the partner's DigiLocker session (the website's own shape; see DigilockerView in the shared package). */
export interface DigilockerPageView {
  state: "none" | "pending" | "authenticated" | "expired" | "consent_denied" | "failed";
  message: string;
  verdict?: "passed" | "review" | "failed" | "error";
  identity?: { name: string; dob: string; gender: string; address: string; pin: string; uid_last4: string };
}

async function call<T>(url: string, method: "GET" | "POST"): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { Accept: "application/json" } });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Please check your connection and try again." };
  }
}

/**
 * One-tap identity through DigiLocker. The partner agrees on DigiLocker's own page (we never see an Aadhaar number, an OTP or a password) and we get the name, date of birth,
 * gender and address it states. While the partner is on that page this page asks for the result every few seconds. When they have agreed, `onVerified` hands the details to
 * the form, which fills only what is still blank.
 */
export function DigilockerCard({ base, onVerified, fills = true, className }: { base: string; onVerified?: (identity: NonNullable<DigilockerPageView["identity"]>, view: DigilockerPageView) => void; /** Whether verifying fills in form fields (the partner's own page does; a team member's link has none). */ fills?: boolean; className?: string }) {
  const [on, setOn] = React.useState<boolean | null>(null);
  const [view, setView] = React.useState<DigilockerPageView>({ state: "none", message: "" });
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState("");
  const delivered = React.useRef<string | null>(null);
  // the latest handler, kept in a ref so that typing in the form does not restart the polling below
  const handler = React.useRef(onVerified);
  handler.current = onVerified;

  const hand = React.useCallback((v: DigilockerPageView) => {
    if (v.state === "authenticated" && v.identity && delivered.current !== v.identity.name + v.identity.dob) {
      delivered.current = v.identity.name + v.identity.dob;
      handler.current?.(v.identity, v);
    }
  }, []);

  // where it stands when the page opens
  React.useEffect(() => {
    let live = true;
    void call<{ configured: boolean; view: DigilockerPageView }>(`${base}/digilocker?poll=1`, "GET").then((r) => {
      if (!live || !r.ok) return;
      setOn(r.data.configured);
      setView(r.data.view);
      hand(r.data.view);
    });
    return () => {
      live = false;
    };
  }, [base]);

  // while they are on DigiLocker's page, ask every few seconds
  React.useEffect(() => {
    if (view.state !== "pending") return;
    let live = true;
    const timer = window.setInterval(() => {
      void call<{ configured: boolean; view: DigilockerPageView }>(`${base}/digilocker?poll=1`, "GET").then((r) => {
        if (!live || !r.ok) return;
        setView(r.data.view);
        hand(r.data.view);
      });
    }, 3000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [view.state, base, hand]);

  async function start() {
    setStarting(true);
    setError("");
    // the tab is opened now, from the click, so a pop-up blocker lets it through; it is pointed at DigiLocker once we have the link
    const tab = window.open("", "_blank");
    const r = await call<{ url: string }>(`${base}/digilocker`, "POST");
    setStarting(false);
    if (!r.ok) {
      tab?.close();
      return setError(r.error);
    }
    if (tab) tab.location.href = r.data.url;
    else window.location.href = r.data.url;
    setView({ state: "pending", message: "Waiting for you to finish on the DigiLocker page. You can come back to this page when you are done." });
  }

  if (on === false) return null;
  const tone = view.state === "authenticated" ? (view.verdict === "passed" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300") : view.state === "pending" ? "text-theme-muted" : "text-amber-700 dark:text-amber-300";
  const Icon = view.state === "authenticated" ? (view.verdict === "passed" ? CheckCircle2 : TriangleAlert) : view.state === "pending" ? Loader2 : Info;
  return (
    <div className={cn("space-y-3 rounded-xl border border-theme-border p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="flex items-center gap-2 text-sm font-medium text-theme-primary">
            <ShieldCheck className="size-4 text-theme-accent" aria-hidden="true" />
            Verify with DigiLocker
          </p>
          <p className="mt-1 text-sm leading-relaxed text-theme-muted">
            One tap, on DigiLocker&apos;s own page. {fills ? "It fills in your date of birth and address. " : "It confirms who you are. "}If it matches, you do not need to send a photo ID. We never see or keep your Aadhaar number, password or OTP, only the last four digits.
          </p>
          {view.state !== "authenticated" && <p className="mt-1 text-xs leading-relaxed text-theme-muted">Tip: add your live selfie first (below), so we can compare your face with the photo DigiLocker holds.</p>}
        </div>
        {view.state !== "authenticated" && (
          <Button type="button" size="sm" onClick={() => void start()} disabled={starting || view.state === "pending"}>
            {starting ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            {view.state === "pending" ? "Waiting for DigiLocker…" : view.state === "none" ? "Verify with DigiLocker" : "Try again"}
          </Button>
        )}
      </div>
      {view.message && (
        <p role="status" className={cn("flex items-start gap-2 text-sm leading-relaxed", tone)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", view.state === "pending" && "animate-spin")} aria-hidden="true" />
          <span>{view.message}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
