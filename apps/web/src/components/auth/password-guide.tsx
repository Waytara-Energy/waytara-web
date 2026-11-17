"use client";

import { Check, Circle } from "lucide-react";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const METER = ["", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"] as const;

/** What a password has to be, as a short list that ticks itself off while the person types, with the same strength bar and tip as "Forgot password". */
export function passwordRules(password: string, confirm: string, min: number): { id: string; label: string; ok: boolean }[] {
  return [
    { id: "length", label: `At least ${min} characters`, ok: password.length >= min },
    { id: "mix", label: "Letters and numbers", ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { id: "match", label: "Both passwords the same", ok: password.length > 0 && password === confirm },
  ];
}

export function PasswordGuide({ password, confirm, min, email = "" }: { password: string; confirm: string; min: number; email?: string }) {
  const rules = passwordRules(password, confirm, min);
  const s = passwordStrength(password, email);
  return (
    <div className="space-y-3 rounded-xl border border-theme-border bg-theme-surface/60 p-3.5" aria-live="polite">
      {password.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-theme-border transition-colors", s.score >= i && METER[s.score])} />
            ))}
            <span className="ml-2 w-16 text-right text-xs font-semibold text-theme-secondary">{s.label}</span>
          </div>
          {s.tips[0] && <p className="text-xs text-theme-muted">{s.tips[0]}</p>}
        </div>
      )}
      <ul className="space-y-1.5">
        {rules.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-2 text-xs transition-colors", r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-theme-muted")}>
            {r.ok ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Circle className="size-3.5 shrink-0" aria-hidden="true" />}
            <span>{r.label}</span>
            <span className="sr-only">{r.ok ? "done" : "not yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
