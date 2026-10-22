import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One card of the settings page: a title, a line saying what it is for, the controls, and (optionally) a footer for its Save button. */
export function SettingsCard({ title, description, children, footer, className }: { title: string; description?: string; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3.5 sm:px-6">{footer}</div>}
    </section>
  );
}

/** A label above a control, with an optional hint underneath. */
export function FieldRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A row with a title and a line of explanation on the left and a control (a switch, a button) on the right. */
export function ToggleRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
