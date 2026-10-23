import { KeyRound, LogIn, LogOut, Mail, ShieldCheck, ShieldOff, Smartphone, type LucideIcon } from "lucide-react";
import { describeEvent, eventWhere, whenText, type AccountEventKind } from "@/lib/account-events";
import { cn } from "@/lib/utils";

export interface ActivityEvent {
  id: string;
  kind: string;
  device: string | null;
  place: string | null;
  ip: string | null;
  created_at: string;
}

const ICON: Record<AccountEventKind, LucideIcon> = {
  signin: LogIn,
  signout: LogOut,
  signout_idle: LogOut,
  signout_limit: LogOut,
  signout_closed: LogOut,
  signout_others: Smartphone,
  signout_all: Smartphone,
  session_revoked: Smartphone,
  password_changed: KeyRound,
  email_changed: Mail,
  mfa_enabled: ShieldCheck,
  mfa_disabled: ShieldOff,
};

const TONE_CLASS = {
  good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  info: "bg-muted text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
} as const;

/** The account activity as a timeline: what happened, on which device and where, and how long ago. `now` is passed in so a render never reads the
 *  clock. */
export function ActivityList({ events, now, empty = "Nothing has happened on your account yet." }: { events: ActivityEvent[]; now: number; empty?: string }) {
  if (events.length === 0) return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {events.map((e) => {
        const style = describeEvent(e.kind);
        const Icon = ICON[e.kind as AccountEventKind] ?? LogIn;
        const where = eventWhere(e);
        return (
          <li key={e.id} className="relative flex items-start gap-3">
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", TONE_CLASS[style.tone])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-foreground">{style.title}</p>
                <time dateTime={e.created_at} className="shrink-0 text-xs text-muted-foreground">
                  {whenText(e.created_at, now)}
                </time>
              </div>
              {where && <p className="truncate text-xs text-muted-foreground">{where}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
