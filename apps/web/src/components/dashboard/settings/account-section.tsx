"use client";

import Link from "next/link";
import { ArrowRight, BellOff, CheckCircle2, Circle, History, LayoutGrid, LifeBuoy, Receipt, Moon, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_LABEL, nextSteps, profileCompleteness, securityScore, type CheckItem, type HealthInput } from "@/lib/account-health";
import { cn } from "@/lib/utils";
import { ActivityList, type ActivityEvent } from "./activity-list";
import { PlanCard, type PlanSummary } from "./plan-card";
import { ProgressRing } from "./progress-ring";
import { IconBubble, Pill, SettingsCard, type Tone } from "./settings-card";
import { useSettingsNav } from "./settings-nav";

export interface AccountProps {
  health: HealthInput;
  events: ActivityEvent[];
  plan: PlanSummary | null;
  /** when notifications are paused until (ISO), or null */
  pausedUntil: string | null;
  /** passed in so a render never reads the clock */
  now: number;
}

const LEVEL_COLOR = { strong: "#10b981", good: "#22c55e", fair: "#f59e0b", weak: "#ef4444" } as const;
const LEVEL_TONE: Record<string, Tone | "danger"> = { strong: "emerald", good: "emerald", fair: "amber", weak: "danger" };

function Checks({ items }: { items: CheckItem[] }) {
  const { go } = useSettingsNav();
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
          {i.done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-500" /> : <Circle className="size-5 shrink-0 text-muted-foreground/60" />}
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium", i.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")}>{i.label}</p>
            {!i.done && <p className="truncate text-xs text-muted-foreground">{i.hint}</p>}
          </div>
          {!i.done && (
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => go(i.tab)}>
              Do it
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Settings > Account: the home of the settings page. How complete the profile is, how well the account is protected, what happened on it lately,
 *  the plan, and the few things people come here to do. */
export function AccountSection({ health, events, plan, pausedUntil, now }: AccountProps) {
  const { go } = useSettingsNav();
  const profile = profileCompleteness(health);
  const security = securityScore(health);
  const steps = nextSteps(health, 3);
  const pausedLabel = pausedUntil ? new Date(pausedUntil).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : null;

  return (
    <div className="space-y-5">
      {steps.length > 0 && (
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <IconBubble icon={Rocket} tone="emerald" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Get the most out of WayTara</h2>
              <p className="text-sm text-muted-foreground">{steps.length === 1 ? "One thing left" : `${steps.length} quick things`} to do, most useful first.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {steps.map((s) => (
              <button key={s.id} type="button" onClick={() => go(s.tab)} className="group flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 text-left outline-none transition-colors hover:border-emerald-500/50 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="-mb-5 columns-1 gap-5 lg:columns-2 2xl:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
        <SettingsCard title="Your profile" description="The more the team knows, the faster they can help." icon={Sparkles} tone="emerald" badge={<Pill tone={profile.percent === 100 ? "emerald" : "amber"}>{profile.percent}% complete</Pill>}>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={profile.percent} aria-valuemin={0} aria-valuemax={100} aria-label="How complete your profile is">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${profile.percent}%` }} />
          </div>
          <Checks items={profile.items} />
        </SettingsCard>

        <SettingsCard title="Security check" description="How well your account is protected." icon={ShieldCheck} tone="indigo" badge={<Pill tone={LEVEL_TONE[security.level]}>{LEVEL_LABEL[security.level]}</Pill>}>
          <div className="flex items-center gap-4">
            <ProgressRing percent={security.score} size={84} stroke={7} color={LEVEL_COLOR[security.level]}>
              <span className="text-lg font-semibold tabular-nums text-foreground">{security.score}</span>
            </ProgressRing>
            <p className="text-sm text-muted-foreground">
              {security.level === "strong" ? "Your account is well protected." : "Turn on what is missing below to raise the score."}
            </p>
          </div>
          <Checks items={security.items} />
        </SettingsCard>


{plan && (
          <PlanCard
            plan={plan}
            action={
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => go("billing")}>
                Billing &amp; payments
                <ArrowRight className="size-3.5" />
              </Button>
            }
          />
        )}

        <SettingsCard
            title="Recent activity"
            description="Sign-ins, sign-outs and changes to your account. If something here is not you, change your password."
            icon={History}
            tone="sky"
            footer={
              <Button type="button" variant="outline" size="sm" onClick={() => go("security")}>
                Open security
                <ArrowRight className="size-3.5" />
              </Button>
            }
          >
            <ActivityList events={events.slice(0, 6)} now={now} />
          </SettingsCard>
        <SettingsCard title="Quick actions" icon={Rocket} tone="amber">
          <ul className="-my-1 divide-y divide-border">
            {[
              { label: pausedLabel ? `Notifications paused until ${pausedLabel}` : "Pause notifications for a while", icon: BellOff, onClick: () => go("notifications") },
              { label: "Choose light or dark", icon: Moon, onClick: () => go("appearance") },
              { label: "Add an alert", icon: Sparkles, onClick: () => go("alerts") },
            ].map((a) => (
              <li key={a.label}>
                <button type="button" onClick={a.onClick} className="flex w-full items-center gap-3 py-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:text-emerald-600 focus-visible:text-emerald-600 dark:hover:text-emerald-400">
                  <a.icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => go("billing")} className="flex w-full items-center gap-3 py-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:text-emerald-600 focus-visible:text-emerald-600 dark:hover:text-emerald-400">
                <Receipt className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">Invoices and payments</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>
            </li>
            <li>
              <Link href="/dashboard?customize=1" className="flex items-center gap-3 py-3 text-sm font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                <LayoutGrid className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">Arrange my Overview</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link href="/dashboard/support" className="flex items-center gap-3 py-3 text-sm font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                <LifeBuoy className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">Talk to support</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
          </ul>
        </SettingsCard>
      </div>
    </div>
  );
}
