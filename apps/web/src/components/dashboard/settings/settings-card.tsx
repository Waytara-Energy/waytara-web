import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "emerald" | "violet" | "sky" | "amber" | "rose" | "teal" | "indigo" | "slate";

/** The colours of a round icon, one per tone (the same set the tabs use). */
export const TONE: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  teal: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  slate: "bg-muted text-muted-foreground",
};

/** A round icon in a tone. */
export function IconBubble({ icon: Icon, tone = "emerald", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE[tone], className)}>
      <Icon className="size-5" />
    </span>
  );
}

/** A small label with a colour: a status ("On", "Not set up"), a count. */
export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: Tone | "danger"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "danger" ? "bg-destructive/15 text-destructive" : TONE[tone], className)}>{children}</span>
  );
}

/** One card of the settings page: an icon and a title, a line saying what it is for, the controls, and (optionally) a footer for its Save button. */
export function SettingsCard({
  title,
  description,
  icon,
  tone = "emerald",
  badge,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** a status at the right of the title (a Pill) */
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          {icon && <IconBubble icon={icon} tone={tone} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {badge}
            </div>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {children}
      </div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/30 px-5 py-3.5 sm:px-6">{footer}</div>}
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
