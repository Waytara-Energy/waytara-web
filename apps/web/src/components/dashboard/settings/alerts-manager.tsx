"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing, Mail, Pencil, Plus, Smartphone } from "lucide-react";
import { alertLook } from "./alert-visuals";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/spinner";
import { COOLDOWN_CHOICES, METRICS, METRIC_GROUPS, formatLimit, metricOf, presetOf, type EffectiveRule, type MetricGroup, type Op } from "@/lib/alert-rules";
import { deleteAlertRule, saveAlertRule, type AlertInput } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { FieldRow } from "./settings-card";

export interface AlertSite {
  id: string;
  name: string;
}

const toInput = (r: EffectiveRule, over: Partial<AlertInput> = {}): AlertInput => ({
  id: r.presetId ? null : r.ruleId,
  presetId: r.presetId,
  name: r.presetId ? "" : r.title,
  metric: r.metric,
  op: r.op,
  threshold: r.threshold,
  siteId: r.siteId,
  email: r.email,
  app: r.app,
  cooldownMinutes: r.cooldownMinutes,
  enabled: r.enabled,
  ...over,
});

/** Settings > Alerts: a gallery of coloured tiles, like the shortcuts of a phone. Smart alerts are WayTara's own for the battery, solar, grid,
 *  consumption and cost (some on from the start; each can be switched off or given another limit), and the customer's own ("tell me when the
 *  battery is below 25%"), made from the first tile. */
export function AlertsManager({ rules, sites }: { rules: EffectiveRule[]; sites: AlertSite[] }) {
  const router = useRouter();
  const [local, setLocal] = React.useState(rules);
  const [seen, setSeen] = React.useState(() => JSON.stringify(rules));
  const incoming = JSON.stringify(rules);
  if (incoming !== seen) {
    setSeen(incoming);
    setLocal(rules);
  }
  const [editing, setEditing] = React.useState<{ rule: EffectiveRule | null } | null>(null);

  const presets = local.filter((r) => r.presetId);
  const mine = local.filter((r) => !r.presetId);
  const groups = METRIC_GROUPS.map((g) => ({ group: g, items: presets.filter((r) => metricOf(r.metric)?.group === g) })).filter((g) => g.items.length > 0);

  async function toggle(rule: EffectiveRule, enabled: boolean) {
    setLocal((cur) => cur.map((r) => (r.key === rule.key ? { ...r, enabled } : r)));
    const ok = await withPromiseToast(saveAlertRule, { loading: "Saving…", success: enabled ? "Alert on." : "Alert off." })(toInput(rule, { enabled }));
    if (ok) router.refresh();
    else setLocal((cur) => cur.map((r) => (r.key === rule.key ? { ...r, enabled: !enabled } : r)));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">My alerts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Tell me when something reaches a limit you choose, for example when the battery level is below 25%.</p>
        </div>
        <ul className={TILES}>
          <li>
            <button
              type="button"
              onClick={() => setEditing({ rule: null })}
              className="flex h-full min-h-36 w-full flex-col items-start justify-between rounded-3xl border-2 border-dashed border-border p-4 text-left outline-none transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Plus className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">New alert</span>
                <span className="block text-xs text-muted-foreground">Pick what to watch and a limit</span>
              </span>
            </button>
          </li>
          {mine.map((r) => (
            <AlertTile key={r.key} rule={r} sites={sites} onToggle={(v) => void toggle(r, v)} onEdit={() => setEditing({ rule: r })} />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Smart alerts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">WayTara keeps an eye on these for you. The ones marked On by default are on for everyone from the start; switch any off, or tap the pencil to change its limit.</p>
        </div>
        <div className="space-y-6">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <ul className={TILES}>
                {items.map((r) => (
                  <AlertTile key={r.key} rule={r} sites={sites} onToggle={(v) => void toggle(r, v)} onEdit={() => setEditing({ rule: r })} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {editing && <AlertDialog rule={editing.rule} sites={sites} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

const TILES = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
const SEVERITY_LABEL: Record<EffectiveRule["severity"], string | null> = { info: null, warning: "Heads-up", critical: "Urgent" };

/** One alert as a coloured tile: its icon, its sentence, where it applies and how you hear about it, an on/off switch and a pencil. Off, it fades to grey. */
function AlertTile({ rule, sites, onToggle, onEdit }: { rule: EffectiveRule; sites: AlertSite[]; onToggle: (on: boolean) => void; onEdit: () => void }) {
  const preset = rule.presetId ? presetOf(rule.presetId) : null;
  const siteName = rule.siteId ? sites.find((s) => s.id === rule.siteId)?.name : null;
  const look = alertLook(rule.metric, rule.op);
  const Icon = look.icon;
  const level = SEVERITY_LABEL[rule.severity];
  return (
    <li className={cn("relative flex min-h-36 flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-sm transition-[filter,opacity]", look.gradient, !rule.enabled && "opacity-70 saturate-0")}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/25 shadow-inner">
          <Icon className="size-5" />
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`${rule.title} on or off`}
          onClick={() => onToggle(!rule.enabled)}
          className={cn("relative h-6 w-10 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white", rule.enabled ? "bg-white/45" : "bg-black/25")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", rule.enabled ? "left-[1.125rem]" : "left-0.5")} />
        </button>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{rule.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-white/80">{preset?.hint ?? (rule.siteId ? siteName ?? "One site" : "All my sites")}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium">
          {rule.email && <Mail className="size-3.5" aria-label="E-mail" />}
          {rule.app && <Smartphone className="size-3.5" aria-label="In the app" />}
          {rule.presetId && rule.untouched && rule.enabled && <span className="rounded-full bg-white/25 px-2 py-0.5">On by default</span>}
          {level && <span className="rounded-full bg-black/20 px-2 py-0.5">{level}</span>}
        </span>
        <button type="button" aria-label={`Edit ${rule.title}`} onClick={onEdit} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/25 outline-none transition-colors hover:bg-white/40 focus-visible:ring-2 focus-visible:ring-white">
          <Pencil className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function AlertDialog({ rule, sites, onClose, onSaved }: { rule: EffectiveRule | null; sites: AlertSite[]; onClose: () => void; onSaved: () => void }) {
  const preset = rule?.presetId ? presetOf(rule.presetId) : null;
  const [name, setName] = React.useState(rule && !rule.presetId ? (rule.title === rule.metric ? "" : rule.title) : "");
  const [metric, setMetric] = React.useState(rule?.metric ?? "battery_soc");
  const [op, setOp] = React.useState<Op>(rule?.op ?? metricOf("battery_soc")!.starter.op);
  const [limit, setLimit] = React.useState(String(rule?.threshold ?? metricOf("battery_soc")!.starter.threshold));
  const [siteId, setSiteId] = React.useState<string>(rule?.siteId ?? "all");
  const [email, setEmail] = React.useState(rule?.email ?? true);
  const [app, setApp] = React.useState(rule?.app ?? true);
  const [cooldown, setCooldown] = React.useState(String(rule?.cooldownMinutes ?? 60));
  const [saving, setSaving] = React.useState(false);

  const m = metricOf(metric);
  const threshold = Number(limit);
  const valid = !!m && limit.trim() !== "" && Number.isFinite(threshold) && (email || app);

  function chooseMetric(id: string) {
    setMetric(id);
    const next = metricOf(id);
    if (next) {
      setOp(next.starter.op);
      setLimit(String(next.starter.threshold));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await withPromiseToast(saveAlertRule, { loading: "Saving…", success: "Alert saved." })({
      id: rule && !rule.presetId ? rule.ruleId : null,
      presetId: rule?.presetId ?? null,
      name,
      metric,
      op,
      threshold,
      siteId: siteId === "all" ? null : siteId,
      email,
      app,
      cooldownMinutes: Number(cooldown),
      enabled: true,
    });
    setSaving(false);
    if (ok) onSaved();
  }

  async function remove() {
    if (!rule?.ruleId) return;
    setSaving(true);
    const ok = await withPromiseToast(deleteAlertRule, { loading: "Removing…", success: rule.presetId ? "Back to the default." : "Alert deleted." })(rule.ruleId);
    setSaving(false);
    if (ok) onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-4" />
            {rule ? (preset ? "Change this alert" : "Edit your alert") : "New alert"}
          </DialogTitle>
          <DialogDescription>{preset ? preset.hint : "Choose what to watch and the limit. You are told once when it is crossed, not every few minutes."}</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          {!preset && (
            <FieldRow label="Name (optional)" htmlFor="alertName">
              <Input id="alertName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Evening battery" />
            </FieldRow>
          )}

          <FieldRow label="Tell me when">
            {preset ? (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">{m?.label}</p>
            ) : (
              <Select value={metric} onValueChange={chooseMetric}>
                <SelectTrigger aria-label="What to watch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {METRIC_GROUPS.map((g: MetricGroup) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {METRICS.filter((x) => x.group === g).map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.label} ({x.unit})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldRow>

          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <FieldRow label="Is">
              {preset ? (
                <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm capitalize text-foreground">{op}</p>
              ) : (
                <Select value={op} onValueChange={(v) => setOp(v as Op)}>
                  <SelectTrigger aria-label="Above or below">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="below">Below</SelectItem>
                    <SelectItem value="above">Above</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FieldRow>
            <FieldRow label={`Limit${m ? ` (${m.unit})` : ""}`} htmlFor="alertLimit" hint={m && valid ? `For example: ${m.label} ${op} ${formatLimit(m, threshold)}` : undefined}>
              <Input id="alertLimit" type="number" inputMode="decimal" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </FieldRow>
          </div>

          {!preset && sites.length > 1 && (
            <FieldRow label="Where">
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger aria-label="Which site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Tell me by</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} />
              <Mail className="size-3.5 text-muted-foreground" />
              E-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={app} onCheckedChange={(v) => setApp(v === true)} />
              <Smartphone className="size-3.5 text-muted-foreground" />
              The bell in the app
            </label>
            {!email && !app && <p className="text-xs text-destructive">Choose at least one.</p>}
          </div>

          <FieldRow label="Do not repeat more often than">
            <Select value={cooldown} onValueChange={setCooldown}>
              <SelectTrigger aria-label="How often it may repeat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COOLDOWN_CHOICES.map((c) => (
                  <SelectItem key={c.minutes} value={String(c.minutes)}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <DialogFooter className="gap-2 sm:justify-between">
            {rule?.ruleId ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => void remove()} className="text-destructive hover:text-destructive">
                {preset ? "Back to default" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || saving}>
                <ButtonSpinner show={saving} />
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
